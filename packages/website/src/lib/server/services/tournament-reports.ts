import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
	MyTournamentReport,
	Tournament,
	TournamentMatch,
	TournamentReport,
	TournamentReportRecord,
	TournamentReportStatus,
	TournamentReportUpdate
} from '@company-of-heroes/api/tournaments';
import type { AuthUserPublic } from '$lib/auth/user';
import { badRequest, forbidden, notFound, rateLimited } from '../errors';
import { chunk, ensure, fromPb, inParallel, pbMaybe, type Task } from '../result';
import { Service } from './service';
import { roundsIn, toMatch, type MatchRecord, type ParticipantRecord } from './tournaments';

/** Open reports one player can have about one match at a time. */
const OPEN_PER_MATCH = 3;
/** Match ids per `mine` filter. */
const MATCHES_PER_QUERY = 50;

type UserRef = { id: string; name?: string };

type ReportRecord = {
	id: string;
	tournament: string;
	match: string;
	reporter: string;
	participant: string;
	reason: TournamentReport['reason'];
	message: string;
	status: TournamentReportStatus;
	staffNote: string;
	handledBy: string;
	handledAt: string;
	created: string;
	expand?: { reporter?: UserRef; handledBy?: UserRef };
};

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');

function toMine(record: ReportRecord): MyTournamentReport {
	return {
		id: record.id,
		reason: record.reason,
		message: record.message ?? '',
		status: record.status,
		staffNote: record.staffNote ?? '',
		created: record.created,
		handledAt: record.handledAt || null
	};
}

const userRef = (user: UserRef | undefined, id: string) =>
	id ? { id, name: user?.name?.trim() || 'Unknown' } : null;

function toRecord(record: ReportRecord, matches: TournamentMatch[]): TournamentReportRecord | null {
	const match = matches.find((m) => m.id === record.match);
	if (!match) {
		return null;
	}

	return {
		...toMine(record),
		match: {
			id: match.id,
			bracket: match.bracket,
			round: match.round,
			position: match.position,
			status: match.status
		},
		rounds: roundsIn(matches, match.bracket),
		reporter: userRef(record.expand?.reporter, record.reporter) ?? { id: '', name: 'Unknown' },
		participant: record.participant || null,
		playerA: match.playerA,
		playerB: match.playerB,
		handledBy: userRef(record.expand?.handledBy, record.handledBy)
	};
}

/**
 * Problem reports of tournament matches (`tournament_reports`): stored with a status, handled by
 * staff with a note the reporter gets to see.
 */
export class TournamentReportsService extends Service {
	private get reports() {
		return this.pb.collection('tournament_reports');
	}

	/** A participant reports a problem with their match; staff get a notification. */
	create(
		user: AuthUserPublic,
		tournamentId: string,
		matchId: string,
		report: TournamentReport
	): Task<MyTournamentReport> {
		const message = report.message.trim();
		return ResultAsync.combine([this.match(tournamentId, matchId), this.tournament(tournamentId)])
			.andThen(([match, tournament]) =>
				ensure(
					tournament.status === 'in_progress',
					badRequest('The tournament is not running.')
				).asyncAndThen(() =>
					this.players(match).andThen((players) => {
						const reporter = players.find((p) => p.user === user.id);
						return reporter
							? okAsync({ match, tournament, players, reporter })
							: errAsync(forbidden('You do not play in this match.'));
					})
				)
			)
			.andThen((found) =>
				this.openOf(matchId, user.id).andThen((open) =>
					open < OPEN_PER_MATCH
						? okAsync(found)
						: errAsync(
								rateLimited(
									'You already have 3 open reports about this match. Wait until staff look at them.'
								)
							)
				)
			)
			.andThen(({ match, tournament, players, reporter }) =>
				fromPb(
					this.reports.create<ReportRecord>({
						tournament: tournament.id,
						match: match.id,
						reporter: user.id,
						participant: reporter.id,
						reason: report.reason,
						message,
						status: 'open'
					}),
					'Could not send the report'
				).andThen((record) => {
					const alias = (id: string | null) => players.find((p) => p.id === id)?.alias ?? 'TBD';
					return this.services.tournamentNotices
						.reportToStaff({
							tournament,
							match,
							reporter: reporter.alias,
							playerA: alias(match.playerA),
							playerB: alias(match.playerB),
							report: { reason: report.reason, message },
							userId: user.id
						})
						.map(() => toMine(record));
				})
			);
	}

	/** Staff: every report of the tournament, newest first. */
	list(tournamentId: string): Task<TournamentReportRecord[]> {
		return ResultAsync.combine([
			fromPb(
				this.reports.getFullList<ReportRecord>({
					filter: this.pb.filter('tournament = {:id}', { id: tournamentId }),
					sort: '-created',
					expand: 'reporter,handledBy'
				}),
				'Could not load the reports'
			),
			this.matches(tournamentId)
		]).map(([records, matches]) => records.flatMap((record) => toRecord(record, matches) ?? []));
	}

	/** Staff: resolve or dismiss; the reporter gets a notification with the note. */
	update(
		staff: AuthUserPublic,
		tournamentId: string,
		reportId: string,
		update: TournamentReportUpdate
	): Task<TournamentReportRecord> {
		const open = update.status === 'open';
		const staffNote = update.staffNote.trim();
		return pbMaybe(this.reports.getOne<ReportRecord>(reportId), 'Could not load the report')
			.andThen((record) =>
				record && record.tournament === tournamentId
					? okAsync(record)
					: errAsync(notFound('Report not found.'))
			)
			.andThen((before) =>
				fromPb(
					this.reports.update<ReportRecord>(
						before.id,
						{
							status: update.status,
							staffNote,
							handledBy: open ? '' : staff.id,
							handledAt: open ? '' : pbDate(new Date())
						},
						{ expand: 'reporter,handledBy' }
					),
					'Could not save the report'
				).map((after) => ({ before, after }))
			)
			.andThen(({ before, after }) =>
				this.matches(tournamentId).andThen((matches) => {
					const record = toRecord(after, matches);
					if (!record) {
						return errAsync(notFound('Match not found.'));
					}

					return (
						after.status !== 'open' && after.status !== before.status
							? this.notifyReporter(after, matches)
							: okAsync(undefined)
					).map(() => record);
				})
			);
	}

	/** Open reports of a tournament (staff badge). */
	openCount(tournamentId: string): Task<number> {
		return fromPb(
			this.reports.getList(1, 1, {
				filter: this.pb.filter('tournament = {:id} && status = "open"', { id: tournamentId }),
				fields: 'id'
			}),
			'Could not load the reports'
		).map((page) => page.totalItems);
	}

	/** The user's own reports per match id, newest first. */
	mine(userId: string, matchIds: string[]): Task<Map<string, MyTournamentReport[]>> {
		const ids = [...new Set(matchIds.filter(Boolean))];
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		return inParallel(chunk(ids, MATCHES_PER_QUERY), 2, (part) =>
			fromPb(
				this.reports.getFullList<ReportRecord>({
					filter: this.pb.filter(
						`reporter = {:user} && (${part.map((_, i) => `match = {:m${i}}`).join(' || ')})`,
						{ user: userId, ...Object.fromEntries(part.map((id, i) => [`m${i}`, id])) }
					),
					sort: '-created'
				}),
				'Could not load your reports'
			)
		).map((parts) => {
			const byMatch = new Map<string, MyTournamentReport[]>();
			for (const record of parts.flat().sort((a, b) => b.created.localeCompare(a.created))) {
				byMatch.set(record.match, [...(byMatch.get(record.match) ?? []), toMine(record)]);
			}

			return byMatch;
		});
	}

	private notifyReporter(record: ReportRecord, matches: TournamentMatch[]): Task<void> {
		const match = matches.find((m) => m.id === record.match);
		return ResultAsync.combine([
			this.tournament(record.tournament),
			match ? this.players(match) : okAsync([] as ParticipantRecord[])
		]).andThen(([tournament, players]) => {
			const alias = (id: string | null | undefined) =>
				players.find((p) => p.id === id)?.alias ?? 'TBD';
			return this.services.tournamentNotices.reportHandled(
				tournament,
				record.reporter,
				`${alias(match?.playerA)} vs ${alias(match?.playerB)}`,
				record.status === 'dismissed' ? 'dismissed' : 'resolved',
				record.staffNote ?? ''
			);
		});
	}

	private tournament(id: string): Task<Tournament> {
		return this.services.tournaments
			.summaries([id])
			.andThen(([tournament]) =>
				tournament ? okAsync(tournament) : errAsync(notFound('Tournament not found.'))
			);
	}

	private match(tournamentId: string, matchId: string): Task<TournamentMatch> {
		return pbMaybe(
			this.pb.collection('tournament_matches').getOne<MatchRecord>(matchId),
			'Could not load the match'
		).andThen((record) =>
			record && record.tournament === tournamentId
				? okAsync(toMatch(record))
				: errAsync(notFound('Match not found.'))
		);
	}

	private matches(tournamentId: string): Task<TournamentMatch[]> {
		return fromPb(
			this.pb.collection('tournament_matches').getFullList<MatchRecord>({
				filter: this.pb.filter('tournament = {:id}', { id: tournamentId })
			}),
			'Could not load the matches'
		).map((records) => records.map(toMatch));
	}

	private players(match: Pick<TournamentMatch, 'playerA' | 'playerB'>): Task<ParticipantRecord[]> {
		const ids = [match.playerA, match.playerB].filter((id): id is string => Boolean(id));
		if (ids.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('tournament_participants').getFullList<ParticipantRecord>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || ')
			}),
			'Could not load the players'
		);
	}

	private openOf(matchId: string, userId: string): Task<number> {
		return fromPb(
			this.reports.getList(1, 1, {
				filter: this.pb.filter('match = {:match} && reporter = {:user} && status = "open"', {
					match: matchId,
					user: userId
				}),
				fields: 'id'
			}),
			'Could not check your reports'
		).map((page) => page.totalItems);
	}
}
