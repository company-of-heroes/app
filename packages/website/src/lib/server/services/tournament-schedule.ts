import { errAsync, okAsync, ResultAsync, type Result } from 'neverthrow';
import {
	TOURNAMENT_SCHEDULE_MAX_TIMES,
	type Tournament,
	type TournamentDetail,
	type TournamentMatch,
	type TournamentScheduleProposal
} from '@company-of-heroes/api/tournaments';
import type { AuthUserPublic } from '$lib/auth/user';
import { badRequest, forbidden, notFound, type AppError } from '../errors';
import { chunk, ensure, fromPb, inParallel, pbMaybe, type Task } from '../result';
import { Service } from './service';
import { utc } from './tournament-notices';
import { toMatch, withDeadlines, type MatchRecord, type ParticipantRecord } from './tournaments';

type ScheduleRecord = {
	id: string;
	tournament: string;
	match: string;
	proposedBy: string;
	times: unknown;
	status: TournamentScheduleProposal['status'];
	acceptedTime: string;
	respondedBy: string;
	reminderSentAt: string;
	created: string;
};

/** Everything a player action on a match needs. */
type Context = {
	tournament: Tournament;
	match: TournamentMatch;
	me: ParticipantRecord;
	opponent: ParticipantRecord;
};

/** A proposed time must be at least this far ahead. */
const LEAD_MS = 5 * 60 * 1000;
/** "Your match starts soon" goes out this long before the agreed time. */
const REMINDER_MS = 30 * 60 * 1000;
/** A reminder that is this late is still sent (the job runs every few minutes). */
const REMINDER_LATE_MS = 5 * 60 * 1000;
const REMIND_BATCH = 200;

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');
const parseDate = (value: string | null | undefined) =>
	value ? Date.parse(value.replace(' ', 'T')) : NaN;
const iso = (value: string) => {
	const time = parseDate(value);
	return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

function toProposal(record: ScheduleRecord): TournamentScheduleProposal {
	const times = Array.isArray(record.times)
		? record.times.map(String).flatMap((time) => iso(time) ?? [])
		: [];
	return {
		id: record.id,
		match: record.match,
		proposedBy: record.proposedBy,
		times: times.sort(),
		status: record.status,
		acceptedTime: record.acceptedTime ? iso(record.acceptedTime) : null,
		created: record.created
	};
}

const START_HINT =
	'Click "Start tournament game" on the dashboard of the desktop app before you start the lobby.';

/**
 * Agreeing on a match time (`tournament_schedules`): a player proposes 1–3 times, the opponent
 * accepts one (`tournament_matches.scheduledAt`) or proposes others. One accepted row per match
 * at most: a newer agreement supersedes the older one.
 */
export class TournamentScheduleService extends Service {
	private get schedules() {
		return this.pb.collection('tournament_schedules');
	}

	private get matches() {
		return this.pb.collection('tournament_matches');
	}

	/** The running tournament, the ready match and both players; the user must play in it. */
	private context(user: AuthUserPublic, tournamentId: string, matchId: string): Task<Context> {
		return ResultAsync.combine([
			this.services.tournaments.summaries([tournamentId]),
			pbMaybe(this.matches.getOne<MatchRecord>(matchId), 'Could not load the match')
		])
			.andThen(([[tournament], record]) =>
				tournament && record && record.tournament === tournament.id
					? okAsync({ tournament, match: withDeadlines(tournament, [toMatch(record)])[0] })
					: errAsync(notFound('Match not found.'))
			)
			.andThen(({ tournament, match }) =>
				ensure(tournament.status === 'in_progress', badRequest('The tournament is not running.'))
					.andThen(() =>
						ensure(
							match.status === 'ready' && !match.bye && match.playerA && match.playerB,
							badRequest('This match is not waiting to be played.')
						)
					)
					.asyncAndThen(() => this.players([match.playerA!, match.playerB!]))
					.andThen((players) => {
						const me = players.find((p) => p.user === user.id);
						const opponent = players.find((p) => p !== me);
						return me && opponent
							? okAsync({ tournament, match, me, opponent })
							: errAsync(forbidden('You do not play in this match.'));
					})
			);
	}

	private players(ids: string[]): Task<ParticipantRecord[]> {
		const unique = [...new Set(ids.filter(Boolean))];
		if (unique.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('tournament_participants').getFullList<ParticipantRecord>({
				filter: unique.map((id) => this.pb.filter('id = {:id}', { id })).join(' || ')
			}),
			'Could not load the players'
		);
	}

	/** Retires the match's open (and with `accepted`, agreed) proposals, except `keep`. */
	private supersede(matchId: string, accepted: boolean, keep = ''): Task<void> {
		return fromPb(
			this.schedules.getFullList<{ id: string }>({
				filter: this.pb.filter(
					accepted
						? 'match = {:matchId} && (status = "pending" || status = "accepted")'
						: 'match = {:matchId} && status = "pending"',
					{ matchId }
				),
				fields: 'id'
			}),
			'Could not load the proposals'
		)
			.andThen((rows) =>
				inParallel(
					rows.filter((row) => row.id !== keep),
					5,
					(row) =>
						fromPb(
							this.schedules.update(row.id, { status: 'superseded' }),
							'Could not save the proposal'
						)
				)
			)
			.map(() => undefined);
	}

	private proposal(context: Context, proposalId: string): Task<ScheduleRecord> {
		return pbMaybe(
			this.schedules.getOne<ScheduleRecord>(proposalId),
			'Could not load the proposal'
		).andThen((record) =>
			record && record.match === context.match.id
				? ensure(
						record.status === 'pending',
						badRequest('These times are no longer open. Reload the page.')
					)
						.andThen(() =>
							ensure(
								record.proposedBy !== context.me.id,
								forbidden('Your opponent picks one of your times.')
							)
						)
						.map(() => record)
				: errAsync(notFound('Proposal not found.'))
		);
	}

	/** Checks, dedupes and sorts the times; each lies in the future and before the deadline. */
	private checkTimes(match: TournamentMatch, times: string[]): Result<string[], AppError> {
		const parsed = [...new Set(times.map((time) => parseDate(time)))].sort((a, b) => a - b);
		const deadline = parseDate(match.deadline);
		const earliest = Date.now() + LEAD_MS;
		return ensure(
			parsed.length > 0 && parsed.length <= TOURNAMENT_SCHEDULE_MAX_TIMES,
			badRequest('Propose 1 to 3 times.')
		)
			.andThen(() =>
				ensure(
					parsed.every((time) => Number.isFinite(time)),
					badRequest('One of the times is not valid.')
				)
			)
			.andThen(() =>
				ensure(
					parsed.every((time) => time > earliest),
					badRequest('Every time must be at least 5 minutes from now.')
				)
			)
			.andThen(() =>
				ensure(
					!Number.isFinite(deadline) || parsed.every((time) => time <= deadline),
					badRequest('Every time must be before the match deadline.')
				)
			)
			.map(() => parsed.map((time) => new Date(time).toISOString()));
	}

	propose(
		user: AuthUserPublic,
		tournamentId: string,
		matchId: string,
		times: string[]
	): Task<TournamentScheduleProposal> {
		return this.context(user, tournamentId, matchId).andThen((context) =>
			this.checkTimes(context.match, times)
				.asyncAndThen((list) =>
					// Created first, then every other open proposal retires: when both players
					// propose at once, one of them stays open instead of two.
					fromPb(
						this.schedules.create<ScheduleRecord>({
							tournament: context.tournament.id,
							match: context.match.id,
							proposedBy: context.me.id,
							times: list,
							status: 'pending'
						}),
						'Could not save the times'
					).andThen((record) =>
						this.supersede(context.match.id, false, record.id).map(() => toProposal(record))
					)
				)
				.andThen((proposal) => this.notifyProposal(context, proposal).map(() => proposal))
		);
	}

	/** The opponent picks a time; the proposer gets a confirmation of what was sent. */
	private notifyProposal(context: Context, proposal: TournamentScheduleProposal): Task<void> {
		const { tournament, me, opponent } = context;
		const plural = proposal.times.length === 1 ? 'a time' : 'times';
		const list = proposal.times.map((time) => `- ${utc(time)}`).join('\n');
		const notices = this.services.tournamentNotices;
		return ResultAsync.combine([
			notices.players(
				[opponent.id],
				tournament,
				`${me.alias} proposed a time for your match`,
				`**${me.alias}** proposed ${plural} for your match in **${tournament.name}**:\n\n${list}` +
					'\n\nOpen the tournament to accept one or propose another time.'
			),
			notices.players(
				[me.id],
				tournament,
				`You proposed a time to ${opponent.alias}`,
				`You proposed ${plural} to **${opponent.alias}** for your match in **${tournament.name}**:\n\n${list}` +
					'\n\nWe let you know when they accept or decline.'
			)
		]).map(() => undefined);
	}

	accept(
		user: AuthUserPublic,
		tournamentId: string,
		matchId: string,
		proposalId: string,
		time: string
	): Task<TournamentScheduleProposal> {
		const picked = parseDate(time);
		return this.context(user, tournamentId, matchId).andThen((context) =>
			this.proposal(context, proposalId)
				.andThen((record) =>
					ensure(
						toProposal(record).times.some((option) => parseDate(option) === picked),
						badRequest('Pick one of the proposed times.')
					)
						.andThen(() =>
							ensure(picked > Date.now(), badRequest('This time has passed. Propose a new one.'))
						)
						.map(() => record)
				)
				.andThen((record) =>
					this.supersede(context.match.id, true).andThen(() =>
						fromPb(
							this.schedules.update<ScheduleRecord>(record.id, {
								status: 'accepted',
								acceptedTime: pbDate(new Date(picked)),
								respondedBy: context.me.id,
								reminderSentAt: ''
							}),
							'Could not save the time'
						)
					)
				)
				.andThen((record) =>
					fromPb(
						this.matches.update(context.match.id, { scheduledAt: pbDate(new Date(picked)) }),
						'Could not save the time'
					).map(() => toProposal(record))
				)
				.andThen((proposal) =>
					this.notifyTime(context.tournament, [context.me, context.opponent], picked).map(
						() => proposal
					)
				)
		);
	}

	decline(
		user: AuthUserPublic,
		tournamentId: string,
		matchId: string,
		proposalId: string
	): Task<TournamentScheduleProposal> {
		return this.context(user, tournamentId, matchId).andThen((context) =>
			this.proposal(context, proposalId)
				.andThen((record) =>
					fromPb(
						this.schedules.update<ScheduleRecord>(record.id, {
							status: 'declined',
							respondedBy: context.me.id
						}),
						'Could not save'
					)
				)
				.map(toProposal)
				.andThen((proposal) =>
					this.services.tournamentNotices
						.players(
							[proposal.proposedBy],
							context.tournament,
							`${context.me.alias} declined your proposed times`,
							`**${context.me.alias}** cannot play your match in **${context.tournament.name}** at ` +
								'the times you proposed. Open the tournament to propose other times.'
						)
						.map(() => proposal)
				)
		);
	}

	/** "Match time set" to both players. */
	private notifyTime(
		tournament: Tournament,
		players: ParticipantRecord[],
		time: number | null
	): Task<void> {
		const [a, b] = players;
		const versus = a && b ? `**${a.alias}** vs **${b.alias}**` : 'Your match';
		const when = time === null ? null : utc(new Date(time).toISOString());
		return this.services.tournamentNotices.players(
			players.map((p) => p.id),
			tournament,
			when ? `Match time set: ${when}` : `Match time cleared in ${tournament.name}`,
			when
				? `${versus} in **${tournament.name}** is set for ${when}. ${START_HINT}`
				: `Staff cleared the agreed time of ${versus} in **${tournament.name}**. ` +
						'Arrange a new time with your opponent on the tournament page.'
		);
	}

	/**
	 * Staff: set or clear the agreed time. Setting stores it as an accepted proposal (on behalf of
	 * player A), so the "starts soon" reminder goes out like for a time the players agreed on.
	 */
	setTime(
		tournamentId: string,
		matchId: string,
		scheduledAt: string | null
	): Task<TournamentDetail> {
		const time = scheduledAt === null ? null : parseDate(scheduledAt);
		return ResultAsync.combine([
			this.services.tournaments.summaries([tournamentId]),
			pbMaybe(this.matches.getOne<MatchRecord>(matchId), 'Could not load the match')
		])
			.andThen(([[tournament], record]) =>
				tournament && record && record.tournament === tournament.id
					? okAsync({ tournament, match: toMatch(record) })
					: errAsync(notFound('Match not found.'))
			)
			.andThen(({ tournament, match }) =>
				ensure(time === null || Number.isFinite(time), badRequest('The time is not valid.'))
					.andThen(() =>
						ensure(match.status !== 'completed', badRequest('This match is already finished.'))
					)
					.asyncAndThen(() => this.supersede(match.id, true))
					.andThen(() =>
						fromPb(
							this.matches.update(match.id, {
								scheduledAt: time === null ? '' : pbDate(new Date(time))
							}),
							'Could not save the time'
						)
					)
					.andThen(() =>
						time !== null && match.playerA && match.playerB
							? fromPb(
									this.schedules.create({
										tournament: tournament.id,
										match: match.id,
										proposedBy: match.playerA,
										times: [new Date(time).toISOString()],
										status: 'accepted',
										acceptedTime: pbDate(new Date(time)),
										respondedBy: match.playerB
									}),
									'Could not save the time'
								).map(() => undefined)
							: okAsync(undefined)
					)
					.andThen(() => this.players([match.playerA ?? '', match.playerB ?? '']))
					.andThen((players) =>
						this.notifyTime(
							tournament,
							[match.playerA, match.playerB].flatMap(
								(id) => players.find((p) => p.id === id) ?? []
							),
							time
						)
					)
					.map(() => tournament.id)
			)
			.andThen((id) => this.services.tournaments.get(id, true));
	}

	/** Latest relevant proposal per match id: the newest pending, else the agreed one. */
	forMatches(matchIds: string[]): Task<Map<string, TournamentScheduleProposal>> {
		const ids = [...new Set(matchIds.filter(Boolean))];
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		const byIds = (field: string, slice: string[]) =>
			slice.map((id) => this.pb.filter(`${field} = {:id}`, { id })).join(' || ');
		return inParallel(chunk(ids, 50), 3, (slice) =>
			ResultAsync.combine([
				fromPb(
					this.schedules.getFullList<ScheduleRecord>({
						filter: `(status = "pending" || status = "accepted") && (${byIds('match', slice)})`,
						sort: '-created'
					}),
					'Could not load the proposals'
				),
				fromPb(
					this.matches.getFullList<{ id: string; scheduledAt: string }>({
						filter: byIds('id', slice),
						fields: 'id,scheduledAt'
					}),
					'Could not load the matches'
				)
			])
		).map((pages) => {
			const scheduled = new Map(
				pages.flatMap(([, matches]) => matches).map((m) => [m.id, parseDate(m.scheduledAt)])
			);
			const records = pages.flatMap(([rows]) => rows);
			const result = new Map<string, TournamentScheduleProposal>();
			for (const id of ids) {
				const own = records.filter((record) => record.match === id);
				const pick =
					own.find((record) => record.status === 'pending') ??
					own.find(
						(record) =>
							record.status === 'accepted' && parseDate(record.acceptedTime) === scheduled.get(id)
					);
				if (pick) {
					result.set(id, toProposal(pick));
				}
			}

			return result;
		});
	}

	/** Job: "your match starts soon" reminders, once per agreed time. Returns how many went out. */
	remind(): Task<number> {
		const now = Date.now();
		return fromPb(
			this.schedules.getList<
				ScheduleRecord & {
					expand?: {
						tournament?: Tournament;
						match?: MatchRecord;
					};
				}
			>(1, REMIND_BATCH, {
				filter: this.pb.filter(
					'status = "accepted" && reminderSentAt = "" && acceptedTime >= {:from} && ' +
						'acceptedTime <= {:to} && tournament.status = "in_progress" && match.status = "ready"',
					{
						from: pbDate(new Date(now - REMINDER_LATE_MS)),
						to: pbDate(new Date(now + REMINDER_MS))
					}
				),
				expand: 'tournament,match',
				skipTotal: true
			}),
			'Could not load the agreed match times'
		).andThen(({ items }) => {
			const due = items.filter(
				(item) =>
					item.expand?.tournament &&
					item.expand.match &&
					parseDate(item.expand.match.scheduledAt) === parseDate(item.acceptedTime)
			);
			return this.players(
				due.flatMap((item) => [item.expand!.match!.playerA, item.expand!.match!.playerB])
			).andThen((players) =>
				inParallel(due, 3, (item) => {
					const tournament = item.expand!.tournament!;
					const match = item.expand!.match!;
					const time = parseDate(item.acceptedTime);
					const minutes = Math.max(0, Math.round((time - Date.now()) / 60_000));
					const alias = (id: string) => players.find((p) => p.id === id)?.alias ?? 'your opponent';
					// Stamp first: a failed notice is a missed reminder, never a second one.
					return fromPb(
						this.schedules.update(item.id, { reminderSentAt: pbDate(new Date()) }),
						'Could not save the reminder'
					).andThen(() =>
						inParallel(
							[
								[match.playerA, match.playerB],
								[match.playerB, match.playerA]
							] as const,
							2,
							([me, opponent]) =>
								this.services.tournamentNotices.players(
									[me],
									tournament,
									minutes > 0
										? `Your match against ${alias(opponent)} starts in ${minutes} minute${minutes === 1 ? '' : 's'}`
										: `Your match against ${alias(opponent)} starts now`,
									`Your match against **${alias(opponent)}** in **${tournament.name}** is set for ` +
										`${utc(item.acceptedTime)}. ${START_HINT}`
								)
						)
					);
				}).map((done) => done.length)
			);
		});
	}
}
