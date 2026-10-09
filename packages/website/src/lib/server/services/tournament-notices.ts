import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
	Tournament,
	TournamentMatch,
	TournamentPost,
	TournamentPostInput,
	TournamentPostKind,
	TournamentPostNotice,
	TournamentReport,
	TournamentReportReason
} from '@company-of-heroes/api';
import type { AuthUserPublic } from '$lib/auth/user';
import { SITE_URL } from '$lib/site/urls';
import { badRequest, notFound } from '../errors';
import { chunk, ensure, fromPb, inParallel, pbMaybe, type Task } from '../result';
import { Service } from './service';
import { toMatch, withDeadlines, type MatchRecord, type ParticipantRecord } from './tournaments';

type PostRecord = {
	id: string;
	tournament: string;
	kind: TournamentPostKind;
	title: string;
	body: string;
	data: unknown;
	important: boolean;
	pinned: boolean;
	created: string;
	updated: string;
};

/** What a notice needs to know about its tournament. */
export type NoticeTournament = Pick<Tournament, 'id' | 'name' | 'slug'>;

type Recipients = 'registered' | 'everyone';

/** Notices of a run of the `tournament-deadlines` job, per kind. */
const JOB_BATCH = 200;
/** Recipients per notification row (the relation holds at most 999). */
const RECIPIENTS_PER_ROW = 900;
/** The "starts soon" reminder goes out this long before the start. */
const REMINDER_MS = 24 * 60 * 60 * 1000;
/** "Your next match is ready" only for matches that became ready this recently. */
const READY_RECENT_MS = 2 * 24 * 60 * 60 * 1000;

const REASONS: Record<TournamentReportReason, string> = {
	no_show: 'Opponent did not show up',
	disconnect: 'Disconnect or crash',
	wrong_result: 'Wrong result',
	conduct: 'Unsportsmanlike behaviour',
	other: 'Other'
};

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');
const parseDate = (value: string) => Date.parse(value.replace(' ', 'T'));

/** Notifications are stored in English; dates in UTC so they read the same for everyone. */
export function utc(value: string | null | undefined): string {
	const time = value ? parseDate(value) : NaN;
	return Number.isFinite(time)
		? `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC`
		: 'a date staff will announce';
}

function roundName(match: Pick<TournamentMatch, 'bracket' | 'round'>): string {
	switch (match.bracket) {
		case 'grand_final':
			return match.round === 2 ? 'the grand final reset' : 'the grand final';
		case 'losers':
			return `losers round ${match.round}`;
		default:
			return `round ${match.round}`;
	}
}

function toPost(record: PostRecord): TournamentPost {
	const data = record.data;
	return {
		id: record.id,
		kind: record.kind,
		title: record.title ?? '',
		body: record.body ?? '',
		data:
			data && typeof data === 'object' && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: {},
		important: Boolean(record.important),
		pinned: Boolean(record.pinned),
		created: record.created,
		updated: record.updated
	};
}

/** English notification text of an automatic post. */
function autoText(
	tournament: NoticeTournament,
	kind: TournamentPostKind,
	data: Record<string, unknown>
): { title: string; body: string } {
	const name = tournament.name;
	switch (kind) {
		case 'rules':
			return {
				title: `${name}: the rules changed`,
				body: `Staff changed the rules of **${name}**. Read them again on the Info tab before your next game.`
			};
		case 'schedule':
			return {
				title: `${name}: new start time`,
				body: `**${name}** now starts on ${utc(data.startsAt as string | null)}.`
			};
		case 'deadlines':
			return {
				title: `${name}: deadlines changed`,
				body: `Staff changed the deadlines of **${name}**. Check when you have to play your match.`
			};
		case 'disqualified':
			return {
				title: `${name}: ${String(data.alias ?? 'A player')} was disqualified`,
				body: `**${String(data.alias ?? 'A player')}** was disqualified from **${name}**. Their opponents go through.`
			};
		case 'seeded':
			return {
				title: `${name}: registration closed`,
				body: `Registration for **${name}** is closed and the players are seeded. The bracket follows when the tournament starts.`
			};
		case 'started':
			return {
				title: `${name} has started`,
				body: `**${name}** started with ${Number(data.players) || 0} players. Your match is on the dashboard of the desktop app.`
			};
		case 'finished':
			return {
				title: `${name} is over`,
				body: data.champion
					? `**${String(data.champion)}** won **${name}**. Every game and replay is public now.`
					: `**${name}** is over. Every game and replay is public now.`
			};
		case 'cancelled':
			return {
				title: `${name} was cancelled`,
				body: `Staff cancelled **${name}**. Its games are public now.`
			};
		default:
			return { title: name, body: '' };
	}
}

/**
 * Everything participants hear about their tournament: the posts on the Updates tab (by staff,
 * or automatic on rule changes, disqualifications, deadlines, start and finish), personal
 * notices (signed up, next match ready, knocked out, final place, staff result), the "starts
 * soon" reminder, the popups of important posts, and match problems reported to staff.
 * Notices never fail the action that caused them.
 */
export class TournamentNoticesService extends Service {
	private get posts() {
		return this.pb.collection('tournament_posts');
	}

	/** The Updates tab: pinned first, then newest first. */
	list(tournamentId: string): Task<TournamentPost[]> {
		return fromPb(
			this.posts.getFullList<PostRecord>({
				filter: this.pb.filter('tournament = {:tournamentId}', { tournamentId }),
				sort: '-pinned,-created'
			}),
			'Could not load the updates'
		).map((records) => records.map(toPost));
	}

	/** Staff: a post on the Updates tab; every participant gets a notification. */
	create(
		tournament: NoticeTournament,
		input: TournamentPostInput,
		staffId: string
	): Task<TournamentPost> {
		return this.checkInput(input)
			.asyncAndThen(() =>
				fromPb(
					this.posts.create<PostRecord>({
						tournament: tournament.id,
						kind: 'announcement',
						title: input.title.trim(),
						body: input.body.trim(),
						data: {},
						important: input.important,
						pinned: input.pinned,
						createdBy: staffId
					}),
					'Could not post the update'
				)
			)
			.andThen((record) =>
				this.quiet(
					this.toParticipants(
						tournament,
						'registered',
						`${tournament.name}: ${record.title}`,
						record.body,
						'updates'
					)
				).map(() => toPost(record))
			);
	}

	/** Staff: edit a post. Participants are not notified again. */
	update(tournamentId: string, postId: string, input: TournamentPostInput): Task<TournamentPost> {
		return this.post(tournamentId, postId).andThen((record) =>
			// Automatic posts are worded by the client; staff may add a title or a note.
			(record.kind === 'announcement' ? this.checkInput(input) : this.checkLength(input))
				.asyncAndThen(() =>
					fromPb(
						this.posts.update<PostRecord>(record.id, {
							title: input.title.trim(),
							body: input.body.trim(),
							important: input.important,
							pinned: input.pinned
						}),
						'Could not save the update'
					)
				)
				.map(toPost)
		);
	}

	remove(tournamentId: string, postId: string): Task<void> {
		return this.post(tournamentId, postId).andThen((record) =>
			fromPb(this.posts.delete(record.id), 'Could not delete the update').map(() => undefined)
		);
	}

	private post(tournamentId: string, postId: string): Task<PostRecord> {
		return pbMaybe(this.posts.getOne<PostRecord>(postId), 'Could not load the update').andThen(
			(record) =>
				record && record.tournament === tournamentId
					? okAsync(record)
					: errAsync(notFound('Update not found.'))
		);
	}

	private checkInput(input: TournamentPostInput) {
		return ensure(input.title.trim().length > 0, badRequest('Give the update a title.')).andThen(
			() => this.checkLength(input)
		);
	}

	private checkLength(input: TournamentPostInput) {
		return ensure(
			input.title.trim().length <= 200 && input.body.length <= 20000,
			badRequest('The update is too long.')
		);
	}

	/** An automatic post plus its notification to the participants. */
	auto(
		tournament: NoticeTournament,
		kind: Exclude<TournamentPostKind, 'announcement'>,
		data: Record<string, unknown> = {},
		important = false
	): Task<void> {
		const text = autoText(tournament, kind, data);
		const recipients: Recipients =
			kind === 'finished' || kind === 'cancelled' ? 'everyone' : 'registered';
		return this.quiet(
			fromPb(
				this.posts.create({
					tournament: tournament.id,
					kind,
					title: '',
					body: '',
					data,
					important
				}),
				'Could not post the update'
			).andThen(() => this.toParticipants(tournament, recipients, text.title, text.body, 'updates'))
		);
	}

	/** Logs instead of failing: a missed notice must not undo a saved result or setting. */
	private quiet(task: Task<unknown>): Task<void> {
		return task
			.map(() => undefined)
			.orElse((error) => {
				console.error('[tournament-notices] could not notify', error);
				return okAsync(undefined);
			});
	}

	private toParticipants(
		tournament: NoticeTournament,
		who: Recipients,
		title: string,
		body: string,
		tab?: 'updates'
	): Task<void> {
		return fromPb(
			this.pb.collection('tournament_participants').getFullList<{ user: string }>({
				filter: this.pb.filter(
					who === 'registered'
						? 'tournament = {:id} && status = "registered"'
						: 'tournament = {:id} && status != "withdrawn"',
					{ id: tournament.id }
				),
				fields: 'user'
			}),
			'Could not load the players'
		).andThen((rows) =>
			this.toUsers(
				rows.map((row) => row.user),
				tournament,
				title,
				body,
				tab
			)
		);
	}

	private toUsers(
		userIds: string[],
		tournament: NoticeTournament,
		title: string,
		body: string,
		tab?: 'updates'
	): Task<void> {
		const users = [...new Set(userIds.filter(Boolean))];
		if (users.length === 0) {
			return okAsync(undefined);
		}

		const url = `${SITE_URL}/tournaments/${tournament.slug}${tab ? `?tab=${tab}` : ''}`;
		return inParallel(chunk(users, RECIPIENTS_PER_ROW), 2, (recipients) =>
			fromPb(
				this.pb.collection('notifications').create({
					title: title.slice(0, 200),
					body: (body || title).slice(0, 9000),
					targetAll: false,
					recipients,
					tournament: tournament.id,
					url
				}),
				'Could not notify the players'
			)
		).map(() => undefined);
	}

	/** Personal notice to the players behind these participant ids. */
	private toPlayers(
		participantIds: (string | null)[],
		tournament: NoticeTournament,
		title: string,
		body: string
	): Task<void> {
		const ids = participantIds.filter((id): id is string => Boolean(id));
		if (ids.length === 0) {
			return okAsync(undefined);
		}

		return this.participantsById(ids).andThen((rows) =>
			this.toUsers(
				rows.map((row) => row.user),
				tournament,
				title,
				body
			)
		);
	}

	private participantsById(ids: string[]): Task<ParticipantRecord[]> {
		const unique = [...new Set(ids)];
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

	/** A personal notice to the players behind these participant ids (never fails). */
	players(
		participantIds: (string | null)[],
		tournament: NoticeTournament,
		title: string,
		body: string
	): Task<void> {
		return this.quiet(this.toPlayers(participantIds, tournament, title, body));
	}

	/** The job closed registration: staff check the seeding and start the tournament. */
	registrationClosed(tournament: NoticeTournament, players: number): Task<void> {
		return this.quiet(
			this.managerIds(tournament.id).andThen((staff) =>
				this.toUsers(
					staff,
					tournament,
					`Registration for ${tournament.name} closed`,
					players < 2
						? `Only ${players} player${players === 1 ? '' : 's'} signed up for **${tournament.name}**. ` +
								'Reopen registration or cancel the tournament.'
						: `${players} players signed up for **${tournament.name}**. Check the seeding and start the tournament.`
				)
			)
		);
	}

	registered(
		tournament: NoticeTournament & { startsAt: string | null },
		userId: string
	): Task<void> {
		return this.quiet(
			this.toUsers(
				[userId],
				tournament,
				`You are signed up for ${tournament.name}`,
				`The tournament starts on ${utc(tournament.startsAt)}. Read the rules on the Info tab and ` +
					'install the desktop app: tournament games are started from its dashboard. We let you know when it starts.'
			)
		);
	}

	/** Public post for everyone, plus a personal notice for the player. */
	disqualified(tournament: NoticeTournament, participantId: string): Task<void> {
		return this.quiet(
			this.participantsById([participantId]).andThen(([participant]) =>
				participant
					? this.toUsers(
							[participant.user],
							tournament,
							`You were disqualified from ${tournament.name}`,
							`Staff disqualified you from **${tournament.name}**. Your open matches count as lost. ` +
								'Contact staff if you think this is a mistake.'
						).andThen(() => this.auto(tournament, 'disqualified', { alias: participant.alias }))
					: okAsync(undefined)
			)
		);
	}

	/** Staff entered or reset a score: both players hear it. */
	staffResult(tournament: NoticeTournament, match: TournamentMatch): Task<void> {
		return this.quiet(
			this.participantsById(
				[match.playerA, match.playerB].filter((id): id is string => !!id)
			).andThen((rows) => {
				const alias = (id: string | null) => rows.find((row) => row.id === id)?.alias ?? 'TBD';
				const score = `**${alias(match.playerA)}** ${match.winsA} – ${match.winsB} **${alias(match.playerB)}**`;
				return this.toUsers(
					rows.map((row) => row.user),
					tournament,
					`Staff updated your match in ${tournament.name}`,
					match.status === 'completed'
						? `Staff set the result of your match (${roundName(match)}): ${score}.`
						: `Staff changed the score of your match (${roundName(match)}) to ${score}. The match goes on.`
				);
			})
		);
	}

	matchDeadline(tournament: NoticeTournament, match: TournamentMatch): Task<void> {
		return this.quiet(
			this.toPlayers(
				[match.playerA, match.playerB],
				tournament,
				`New deadline for your match in ${tournament.name}`,
				`Your match (${roundName(match)}) now has to be played before ${utc(match.deadline)}.`
			)
		);
	}

	/** Everyone hears their final place; the post names the champion. */
	finished(
		tournament: NoticeTournament,
		places: Map<string, number>,
		champion: string | null
	): Task<void> {
		return this.quiet(
			this.participantsById([...places.keys()])
				.andThen((rows) =>
					inParallel(rows, 5, (row) => {
						const place = places.get(row.id) ?? 0;
						return this.toUsers(
							[row.user],
							tournament,
							place === 1
								? `You won ${tournament.name}!`
								: `${tournament.name} is over: you finished #${place}`,
							place === 1
								? 'Congratulations, champion! Your medal is on your player profile now.'
								: `Thanks for playing. You finished **#${place}** of ${rows.length}.`
						);
					})
				)
				.andThen(() => this.auto(tournament, 'finished', { champion }))
		);
	}

	/** The `tournament-deadlines` job: reminders, next matches and knock-outs. */
	run(): Task<{ processed: number; more: boolean }> {
		return ResultAsync.combine([this.remindStarts(), this.readyMatches(), this.knockedOut()]).map(
			(counts) => ({
				processed: counts.reduce((sum, count) => sum + count, 0),
				more: counts.some((count) => count >= JOB_BATCH)
			})
		);
	}

	/** One "starts soon" notice per tournament, a day before its start. */
	private remindStarts(): Task<number> {
		const now = new Date();
		return fromPb(
			this.pb.collection('tournaments').getList<{
				id: string;
				name: string;
				slug: string;
				startsAt: string;
			}>(1, JOB_BATCH, {
				filter: this.pb.filter(
					'(status = "registration" || status = "seeding") && reminderSentAt = "" && ' +
						'startsAt != "" && startsAt > {:now} && startsAt <= {:soon}',
					{ now: pbDate(now), soon: pbDate(new Date(now.getTime() + REMINDER_MS)) }
				),
				fields: 'id,name,slug,startsAt',
				skipTotal: true
			}),
			'Could not load tournaments'
		).andThen(({ items }) =>
			inParallel(items, 3, (tournament) =>
				this.quiet(
					this.toParticipants(
						tournament,
						'registered',
						`${tournament.name} starts soon`,
						`**${tournament.name}** starts on ${utc(tournament.startsAt)}. Make sure the desktop ` +
							'app is installed and you are signed in, so you can start your tournament games.'
					)
				).andThen(() =>
					fromPb(
						this.pb
							.collection('tournaments')
							.update(tournament.id, { reminderSentAt: pbDate(new Date()) }),
						'Could not save the tournament'
					)
				)
			).map((done) => done.length)
		);
	}

	/** Both players of a match that just got its second player. */
	private readyMatches(): Task<number> {
		return fromPb(
			this.pb.collection('tournament_matches').getList<MatchRecord>(1, JOB_BATCH, {
				// Matches ready for longer are old news (e.g. running tournaments when this shipped).
				filter: this.pb.filter(
					'status = "ready" && bye = false && readyNotifiedAt = "" && playerA != "" && ' +
						'playerB != "" && readyAt >= {:recent} && tournament.status = "in_progress"',
					{ recent: pbDate(new Date(Date.now() - READY_RECENT_MS)) }
				),
				skipTotal: true
			}),
			'Could not load tournament matches'
		).andThen(({ items }) => {
			if (items.length === 0) {
				return okAsync(0);
			}

			return ResultAsync.combine([
				this.services.tournaments.summaries(items.map((item) => item.tournament)),
				this.participantsById(items.flatMap((item) => [item.playerA, item.playerB]))
			]).andThen(([tournaments, players]) => {
				const byId = new Map(players.map((p) => [p.id, p]));
				const matches = tournaments.flatMap((tournament) =>
					withDeadlines(
						tournament,
						items.filter((item) => item.tournament === tournament.id).map(toMatch)
					).map((match) => ({ tournament, match }))
				);
				return inParallel(matches, 3, ({ tournament, match }) =>
					this.quiet(
						inParallel(
							[
								[match.playerA, match.playerB],
								[match.playerB, match.playerA]
							] as const,
							2,
							([me, opponent]) => {
								const player = me ? byId.get(me) : undefined;
								const rival = opponent ? byId.get(opponent) : undefined;
								return player
									? this.toUsers(
											[player.user],
											tournament,
											`Your next match in ${tournament.name} is ready`,
											`You play **${rival?.alias ?? 'your opponent'}** in ${roundName(match)}, best of ${match.bestOf}` +
												(match.deadline ? `, before ${utc(match.deadline)}` : '') +
												'. Contact your opponent, then click "Start tournament game" on the dashboard of ' +
												'the desktop app before you start the lobby.'
										)
									: okAsync(undefined);
							}
						)
					).andThen(() =>
						fromPb(
							this.pb
								.collection('tournament_matches')
								.update(match.id, { readyNotifiedAt: pbDate(new Date()) }),
							'Could not save the match'
						)
					)
				).map((done) => done.length);
			});
		});
	}

	/** Losers of recently finished matches who have no match left in a running elimination bracket. */
	private knockedOut(): Task<number> {
		return fromPb(
			this.pb.collection('tournament_matches').getList<MatchRecord>(1, JOB_BATCH, {
				filter: this.pb.filter(
					'status = "completed" && bye = false && winner != "" && updated >= {:recent} && ' +
						'tournament.status = "in_progress" && tournament.format != "round_robin"',
					{ recent: pbDate(new Date(Date.now() - READY_RECENT_MS)) }
				),
				fields: 'playerA,playerB,winner',
				skipTotal: true
			}),
			'Could not load tournament matches'
		)
			.andThen(({ items }) => {
				const losers = items.map((m) => (m.winner === m.playerA ? m.playerB : m.playerA));
				return this.participantsById(losers.filter(Boolean));
			})
			.map((rows) => rows.filter((p) => p.status === 'registered' && !p.outNotifiedAt))
			.andThen((items) => this.notifyOut(items));
	}

	private notifyOut(items: ParticipantRecord[]): Task<number> {
		const tournamentIds = [...new Set(items.map((p) => p.tournament))];
		if (tournamentIds.length === 0) {
			return okAsync(0);
		}

		return ResultAsync.combine([
			this.services.tournaments.summaries(tournamentIds),
			fromPb(
				this.pb.collection('tournament_matches').getFullList<MatchRecord>({
					filter: tournamentIds
						.map((id) => this.pb.filter('tournament = {:id}', { id }))
						.join(' || ')
				}),
				'Could not load tournament matches'
			)
		]).andThen(([tournaments, records]) => {
			const matches = records.map(toMatch);
			const out = items.filter((participant) => {
				const own = matches.filter(
					(m) => m.playerA === participant.id || m.playerB === participant.id
				);
				return (
					own.some((m) => m.status === 'completed' && m.winner && m.winner !== participant.id) &&
					own.every((m) => m.status === 'completed')
				);
			});
			return inParallel(out, 3, (participant) => {
				const tournament = tournaments.find((t) => t.id === participant.tournament);
				return (
					tournament
						? this.quiet(
								this.toUsers(
									[participant.user],
									tournament,
									`You are out of ${tournament.name}`,
									'Thanks for playing! Your final place follows when the tournament ends. You can keep ' +
										'following the bracket on the tournament page.'
								)
							)
						: okAsync(undefined)
				).andThen(() =>
					fromPb(
						this.pb
							.collection('tournament_participants')
							.update(participant.id, { outNotifiedAt: pbDate(new Date()) }),
						'Could not save the player'
					)
				);
			}).map((done) => done.length);
		});
	}

	/** Round 1 is in the start post and popup: no extra "match ready" notice for it. */
	skipReadyNotices(tournamentId: string): Task<void> {
		return this.quiet(
			fromPb(
				this.pb.collection('tournament_matches').getFullList<{ id: string }>({
					filter: this.pb.filter('tournament = {:tournamentId} && status = "ready"', {
						tournamentId
					}),
					fields: 'id'
				}),
				'Could not load tournament matches'
			).andThen((rows) =>
				inParallel(rows, 5, (row) =>
					fromPb(
						this.pb
							.collection('tournament_matches')
							.update(row.id, { readyNotifiedAt: pbDate(new Date()) }),
						'Could not save the match'
					)
				)
			)
		);
	}

	/** Important posts in the user's tournaments they have not seen yet, oldest first. */
	unseen(user: AuthUserPublic): Task<TournamentPostNotice[]> {
		return this.myPlaces(user).andThen((places) => {
			if (places.length === 0) {
				return okAsync([]);
			}

			const filter = places
				.map((place) =>
					this.pb.filter('(tournament = {:id} && created > {:after})', {
						id: place.tournament,
						// Posts from before the player signed up are not news to them.
						after: [place.postsSeenAt, place.created].filter(Boolean).sort().at(-1) ?? ''
					})
				)
				.join(' || ');
			return fromPb(
				this.posts.getList<PostRecord>(1, 20, {
					filter: `important = true && (${filter})`,
					sort: 'created',
					skipTotal: true
				}),
				'Could not load the updates'
			).andThen(({ items }) =>
				this.services.tournaments
					.summaries(items.map((item) => item.tournament))
					.map((tournaments) =>
						items.flatMap((item) => {
							const tournament = tournaments.find((t) => t.id === item.tournament);
							return tournament
								? [
										{
											post: toPost(item),
											tournament: {
												id: tournament.id,
												name: tournament.name,
												slug: tournament.slug,
												format: tournament.format,
												logoUrl: tournament.logoUrl,
												medal: tournament.medal
											}
										}
									]
								: [];
						})
					)
			);
		});
	}

	/** The popups of these tournaments' posts were shown: everything until now is seen. */
	markPostsSeen(user: AuthUserPublic, tournamentIds: string[]): Task<void> {
		const ids = new Set(tournamentIds);
		if (ids.size === 0) {
			return okAsync(undefined);
		}

		return this.myPlaces(user).andThen((places) =>
			inParallel(
				places.filter((place) => ids.has(place.tournament)),
				5,
				(place) =>
					fromPb(
						this.pb
							.collection('tournament_participants')
							.update(place.id, { postsSeenAt: pbDate(new Date()) }),
						'Could not save'
					)
			).map(() => undefined)
		);
	}

	private myPlaces(
		user: AuthUserPublic
	): Task<{ id: string; tournament: string; postsSeenAt: string; created: string }[]> {
		return fromPb(
			this.pb.collection('tournament_participants').getFullList<{
				id: string;
				tournament: string;
				postsSeenAt: string;
				created: string;
			}>({
				filter: this.pb.filter(
					'user = {:user} && status != "withdrawn" && tournament.status != "draft" && ' +
						'tournament.updated > {:since}',
					{ user: user.id, since: pbDate(new Date(Date.now() - 30 * 86_400_000)) }
				),
				fields: 'id,tournament,postsSeenAt,created'
			}),
			'Could not load your tournaments'
		);
	}

	/**
	 * Staff hear about a problem report (stored by `tournament-reports.ts`); the link opens the
	 * reports dialog on the tournament page.
	 */
	reportToStaff(input: {
		tournament: NoticeTournament;
		match: Pick<TournamentMatch, 'bracket' | 'round'>;
		reporter: string;
		playerA: string;
		playerB: string;
		report: TournamentReport;
		userId: string;
	}): Task<void> {
		const { tournament, report } = input;
		const page = `${SITE_URL}/tournaments/${tournament.slug}`;
		const message = report.message.trim();
		return this.quiet(
			this.managerIds(tournament.id).andThen((staff) =>
				staff.length === 0
					? okAsync(undefined)
					: fromPb(
							this.pb.collection('notifications').create({
								title: `Tournament problem: ${REASONS[report.reason]}`.slice(0, 200),
								body:
									`**${input.reporter}** reported a problem with **${input.playerA}** vs ` +
									`**${input.playerB}** (${roundName(input.match)}) in **${tournament.name}**: ` +
									`${REASONS[report.reason]}.` +
									(message ? `\n\n> ${message.replace(/\n/g, '\n> ')}` : '') +
									`\n\nSet a result, a new deadline or contact the players on the [tournament page](${page}).`,
								targetAll: false,
								recipients: staff,
								tournament: tournament.id,
								url: `${page}?reports=1`
							}),
							'Could not notify staff'
						)
			)
		);
	}

	/** The reporter hears that staff resolved or dismissed their report, with the staff note. */
	reportHandled(
		tournament: NoticeTournament,
		userId: string,
		match: string,
		status: 'resolved' | 'dismissed',
		note: string
	): Task<void> {
		const title = `Your report about ${match} was ${status}`;
		const body =
			note.trim() ||
			(status === 'resolved'
				? `Staff of **${tournament.name}** looked into your report and handled it.`
				: `Staff of **${tournament.name}** looked into your report and closed it without changes.`);
		return this.quiet(this.toUsers([userId], tournament, title, body));
	}

	/** Everyone who runs the tournament: staff, and the community host who created it. */
	managerIds(tournamentId: string): Task<string[]> {
		return pbMaybe(
			this.pb
				.collection('tournaments')
				.getOne<{ createdBy: string }>(tournamentId, { fields: 'createdBy' }),
			'Could not load the tournament'
		).andThen((record) =>
			fromPb(
				this.pb.collection('users').getFullList<{ id: string }>({
					filter: record?.createdBy
						? this.pb.filter(
								'role = "admin" || role = "moderator" || (role = "host" && id = {:host})',
								{ host: record.createdBy }
							)
						: 'role = "admin" || role = "moderator"',
					fields: 'id'
				}),
				'Could not load staff'
			).map((rows) => rows.map((row) => row.id))
		);
	}
}
