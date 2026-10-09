import type { ResultAsync } from 'neverthrow';
import { sendV1, type ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { fromPbPromise } from '../pb';
import type {
	HallOfFame,
	MyTournaments,
	Tournament,
	TournamentArm,
	TournamentDetail,
	TournamentImages,
	TournamentInput,
	TournamentMatch,
	TournamentMatchResult,
	TournamentPost,
	TournamentPostInput,
	TournamentReport,
	TournamentReportRecord,
	TournamentReportUpdate,
	TournamentScheduleProposal,
	TournamentScope,
	TournamentSeen,
	TournamentStats,
	TournamentUpdate
} from './types';
import type { TournamentMap } from './maps';

/** Only the images that change: files to upload, flags to clear. */
function imageBody(images: TournamentImages): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (images.banner) {
		body.banner = images.banner;
	}

	if (images.logo) {
		body.logo = images.logo;
	}

	if (images.clearBanner) {
		body.clearBanner = true;
	}

	if (images.clearLogo) {
		body.clearLogo = true;
	}

	return body;
}

const path = (idOrSlug: string, rest = '') => `/tournaments/${encodeURIComponent(idOrSlug)}${rest}`;

/** Tournaments on the website's `/api/v1/tournaments`; staff-only calls are checked there. */
export class TournamentsApi {
	constructor(private deps: ApiDeps) {}

	list(scope: TournamentScope): ResultAsync<Tournament[], ApiError> {
		return fromPbPromise(
			sendV1<Tournament[]>(this.deps, `/tournaments?scope=${scope}`),
			'Could not load tournaments.'
		);
	}

	/** Finished tournaments the player won, newest first. */
	wonBy(steamId: string): ResultAsync<Tournament[], ApiError> {
		return fromPbPromise(
			sendV1<Tournament[]>(this.deps, `/tournaments/won/${encodeURIComponent(steamId)}`),
			'Could not load tournaments.'
		);
	}

	get(idOrSlug: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(idOrSlug)),
			'Tournament not found.'
		);
	}

	/** Images go up as multipart next to the fields (see `sendV1`). */
	create(input: TournamentInput, images: TournamentImages = {}): ResultAsync<Tournament, ApiError> {
		return fromPbPromise(
			sendV1<Tournament>(this.deps, '/tournaments', {
				method: 'POST',
				body: { ...input, ...imageBody(images) }
			}),
			'Could not create the tournament.'
		);
	}

	update(
		id: string,
		input: TournamentUpdate,
		images: TournamentImages = {}
	): ResultAsync<Tournament, ApiError> {
		return fromPbPromise(
			sendV1<Tournament>(this.deps, path(id), {
				method: 'PATCH',
				body: { ...input, ...imageBody(images) }
			}),
			'Could not save the tournament.'
		);
	}

	/** Staff-made maps (built-in maps are `BUILT_IN_MAPS`). */
	listMaps(): ResultAsync<TournamentMap[], ApiError> {
		return fromPbPromise(
			sendV1<TournamentMap[]>(this.deps, '/tournaments/maps'),
			'Could not load the maps.'
		);
	}

	createMap(name: string, icon: File | null): ResultAsync<TournamentMap, ApiError> {
		return fromPbPromise(
			sendV1<TournamentMap>(this.deps, '/tournaments/maps', {
				method: 'POST',
				body: icon ? { name, icon } : { name }
			}),
			'Could not add the map.'
		);
	}

	/**
	 * Signs the user up with one of their linked Steam accounts. `acceptRules` is required when
	 * the tournament has rules.
	 */
	register(
		id: string,
		steamId: string,
		acceptRules: boolean
	): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/registration'), {
				method: 'POST',
				body: { steamId, acceptRules }
			}),
			'Could not sign up.'
		);
	}

	/** A participant accepts the current rules (again, after they changed). */
	acceptRules(id: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/rules/accept'), { method: 'POST' }),
			'Could not accept the rules.'
		);
	}

	withdraw(id: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/registration'), { method: 'DELETE' }),
			'Could not withdraw.'
		);
	}

	/** Closes registration and seeds everyone by 1v1 ELO. */
	seed(id: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/seeds'), { method: 'POST' }),
			'Could not seed the tournament.'
		);
	}

	/** Participant ids, top seed first. */
	setSeeds(id: string, order: string[]): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/seeds'), {
				method: 'PUT',
				body: { order }
			}),
			'Could not save the seeding.'
		);
	}

	start(id: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/start'), { method: 'POST' }),
			'Could not start the tournament.'
		);
	}

	setMatchResult(
		id: string,
		matchId: string,
		result: TournamentMatchResult
	): ResultAsync<TournamentMatch[], ApiError> {
		return fromPbPromise(
			sendV1<TournamentMatch[]>(this.deps, path(id, `/matches/${encodeURIComponent(matchId)}`), {
				method: 'PATCH',
				body: result
			}),
			'Could not save the result.'
		);
	}

	disqualify(id: string, participantId: string): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(
				this.deps,
				path(id, `/participants/${encodeURIComponent(participantId)}`),
				{ method: 'DELETE' }
			),
			'Could not disqualify the player.'
		);
	}

	/** Staff: last moment to play per round (`roundKey` → ISO date, null clears it). */
	setRoundDeadlines(
		id: string,
		rounds: Record<string, string | null>
	): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/deadlines'), {
				method: 'PUT',
				body: { rounds }
			}),
			'Could not save the deadlines.'
		);
	}

	/** Staff: a deadline for one match (null: its round's again). */
	setMatchDeadline(
		id: string,
		matchId: string,
		deadline: string | null
	): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(
				this.deps,
				path(id, `/matches/${encodeURIComponent(matchId)}/deadline`),
				{ method: 'PUT', body: { deadline } }
			),
			'Could not save the deadline.'
		);
	}

	/** The signed-in player's open matches and processed games they have not seen yet. */
	mine(): ResultAsync<MyTournaments, ApiError> {
		return fromPbPromise(
			sendV1<MyTournaments>(this.deps, '/tournaments/me'),
			'Could not load your tournament matches.'
		);
	}

	/** The popups of these games, tournament starts and updates were shown. */
	markSeen(seen: TournamentSeen): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1<unknown>(this.deps, '/tournaments/me/seen', { method: 'POST', body: seen }),
			'Could not save.'
		).map(() => undefined);
	}

	/** Staff: a post on the Updates tab; participants get a notification. */
	createPost(id: string, input: TournamentPostInput): ResultAsync<TournamentPost, ApiError> {
		return fromPbPromise(
			sendV1<TournamentPost>(this.deps, path(id, '/posts'), { method: 'POST', body: input }),
			'Could not post the update.'
		);
	}

	/** Staff: edit a post (no new notification). */
	updatePost(
		id: string,
		postId: string,
		input: TournamentPostInput
	): ResultAsync<TournamentPost, ApiError> {
		return fromPbPromise(
			sendV1<TournamentPost>(this.deps, path(id, `/posts/${encodeURIComponent(postId)}`), {
				method: 'PATCH',
				body: input
			}),
			'Could not save the update.'
		);
	}

	deletePost(id: string, postId: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1<unknown>(this.deps, path(id, `/posts/${encodeURIComponent(postId)}`), {
				method: 'DELETE'
			}),
			'Could not delete the update.'
		).map(() => undefined);
	}

	/** A participant reports a problem with their match to staff. */
	report(id: string, matchId: string, report: TournamentReport): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1<unknown>(this.deps, path(id, `/matches/${encodeURIComponent(matchId)}/report`), {
				method: 'POST',
				body: report
			}),
			'Could not send the report.'
		).map(() => undefined);
	}

	/** Staff: every problem report of the tournament, newest first. */
	reports(id: string): ResultAsync<TournamentReportRecord[], ApiError> {
		return fromPbPromise(
			sendV1<TournamentReportRecord[]>(this.deps, path(id, '/reports')),
			'Could not load the reports.'
		);
	}

	/** Staff: resolve or dismiss a report; the reporter hears the note. */
	updateReport(
		id: string,
		reportId: string,
		update: TournamentReportUpdate
	): ResultAsync<TournamentReportRecord, ApiError> {
		return fromPbPromise(
			sendV1<TournamentReportRecord>(
				this.deps,
				path(id, `/reports/${encodeURIComponent(reportId)}`),
				{ method: 'PATCH', body: update }
			),
			'Could not save the report.'
		);
	}

	/** A player proposes 1–3 times for their match (replaces their open proposal). */
	proposeTimes(
		id: string,
		matchId: string,
		times: string[]
	): ResultAsync<TournamentScheduleProposal, ApiError> {
		return fromPbPromise(
			sendV1<TournamentScheduleProposal>(
				this.deps,
				path(id, `/matches/${encodeURIComponent(matchId)}/schedule`),
				{ method: 'POST', body: { times } }
			),
			'Could not propose the times.'
		);
	}

	/** The opponent accepts one of the proposed times. */
	acceptTime(
		id: string,
		matchId: string,
		proposalId: string,
		time: string
	): ResultAsync<TournamentScheduleProposal, ApiError> {
		return fromPbPromise(
			sendV1<TournamentScheduleProposal>(
				this.deps,
				path(
					id,
					`/matches/${encodeURIComponent(matchId)}/schedule/${encodeURIComponent(proposalId)}/accept`
				),
				{ method: 'POST', body: { time } }
			),
			'Could not accept the time.'
		);
	}

	/** The opponent declines the proposed times. */
	declineTimes(
		id: string,
		matchId: string,
		proposalId: string
	): ResultAsync<TournamentScheduleProposal, ApiError> {
		return fromPbPromise(
			sendV1<TournamentScheduleProposal>(
				this.deps,
				path(
					id,
					`/matches/${encodeURIComponent(matchId)}/schedule/${encodeURIComponent(proposalId)}/decline`
				),
				{ method: 'POST' }
			),
			'Could not decline the times.'
		);
	}

	/** Staff: set or clear the agreed time of a match. */
	setMatchTime(
		id: string,
		matchId: string,
		scheduledAt: string | null
	): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(
				this.deps,
				path(id, `/matches/${encodeURIComponent(matchId)}/time`),
				{
					method: 'PUT',
					body: { scheduledAt }
				}
			),
			'Could not save the match time.'
		);
	}

	/** Staff: put a match in the spotlight (null clears it). */
	feature(id: string, matchId: string | null): ResultAsync<TournamentDetail, ApiError> {
		return fromPbPromise(
			sendV1<TournamentDetail>(this.deps, path(id, '/featured'), {
				method: 'PUT',
				body: { matchId }
			}),
			'Could not save the featured match.'
		);
	}

	/** Numbers of a finished tournament. */
	stats(idOrSlug: string): ResultAsync<TournamentStats, ApiError> {
		return fromPbPromise(
			sendV1<TournamentStats>(this.deps, path(idOrSlug, '/stats')),
			'Could not load the stats.'
		);
	}

	/** Champions and podiums of every finished tournament. */
	hallOfFame(): ResultAsync<HallOfFame, ApiError> {
		return fromPbPromise(
			sendV1<HallOfFame>(this.deps, '/tournaments/hall-of-fame'),
			'Could not load the hall of fame.'
		);
	}

	/** "Start tournament game": the next lobby with the opponent becomes the game. */
	arm(id: string, matchId: string): ResultAsync<TournamentArm, ApiError> {
		return fromPbPromise(
			sendV1<TournamentArm>(this.deps, path(id, `/matches/${encodeURIComponent(matchId)}/arm`), {
				method: 'POST'
			}),
			'Could not start the tournament game.'
		);
	}

	/** The armed lobby started (its Relic session and the players' Steam ids). */
	claim(
		id: string,
		matchId: string,
		sessionId: number,
		steamIds: string[]
	): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1<unknown>(this.deps, path(id, `/matches/${encodeURIComponent(matchId)}/claim`), {
				method: 'POST',
				body: { sessionId, steamIds }
			}),
			'Could not link the lobby to the tournament game.'
		).map(() => undefined);
	}
}
