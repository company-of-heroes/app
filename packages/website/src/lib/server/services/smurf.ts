import { err, ok, okAsync, ResultAsync } from 'neverthrow';
import { badRequest, notFound } from '../errors';
import { anyOfChunks } from '../pb';
import { ensure, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

type SmurfWatchRecord = {
	id: string;
	steam_id: string;
	profile_id: number;
	status: string;
	source: string;
	lender_steam_id: string;
	lender_source: string;
	owns_coh: boolean;
	next_check_at: string;
	smurf_score: number;
	verdict: string;
	signals: unknown;
	suspected_main_steam_id: string;
	main_confidence: number;
	score_computed_at: string;
	last_live_check_at: string;
};

/** Where a Steam id was seen; higher priority is screened first. */
export const SMURF_SOURCE_PRIORITY = {
	lobby_live: 100,
	profile: 75,
	search: 70,
	lobby_match: 50,
	backfill: 10
} as const;
export type SmurfSource = keyof typeof SMURF_SOURCE_PRIORITY;

/** Seen in a lobby: may reopen accounts that were cleared earlier. */
const LIVE_SIGHTS: SmurfSource[] = ['lobby_live', 'lobby_match'];
const REOPENABLE = ['not_smurf', 'expired', 'unknown_private'];
/** Company of Heroes (New Steam Version). */
const COH_APP_ID = '228200';
/** Minimum gap between live lender checks for one account. */
const LIVE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const STEAM_ID = /^7656\d{13}$/;
/** Most frequent teammates whose games are searched for a main account. */
const COPLAY_SECOND_ORDER_TEAMMATES = 50;

/** Fields the smurf worker may write. */
const WORKER_FIELDS = [
	'status',
	'lender_steam_id',
	'lender_source',
	'owns_coh',
	'last_checked_at',
	'next_check_at',
	'check_interval_sec',
	'priority',
	'watching_since',
	'account_created_at',
	'coh_playtime_min',
	'game_bans',
	'vac_banned',
	'relic_total_games',
	'relic_winrate',
	'relic_level',
	'signals',
	'smurf_score',
	'verdict',
	'score_computed_at',
	'main_candidates',
	'suspected_main_steam_id',
	'main_confidence'
];

type IndexRow = { lobby: string; profile_id: number };
type PlayerMeta = { alias: string | null; steam_id: string | null };
/** Smurf screening state per Steam account (`smurf_watch`, scored by the smurf worker). */
export class SmurfService extends Service {
	get(steamId: string) {
		return ensure(steamId, badRequest('steamId is required'))
			.asyncAndThen(() => this.findBySteamId(steamId))
			.andThen((record) =>
				record
					? ok({
							id: record.id,
							steam_id: record.steam_id,
							profile_id: record.profile_id,
							status: record.status,
							source: record.source,
							lender_steam_id: record.lender_steam_id || null,
							lender_source: record.lender_source || null,
							owns_coh: record.owns_coh,
							next_check_at: record.next_check_at,
							smurf_score: record.smurf_score,
							verdict: record.verdict || null,
							signals: record.signals || null,
							suspected_main_steam_id: record.suspected_main_steam_id || null,
							main_confidence: record.main_confidence,
							score_computed_at: record.score_computed_at || null
						})
					: err(notFound('Not found'))
			);
	}

	private findBySteamId(
		steamId: string
	): Task<(SmurfWatchRecord & { priority: number }) | undefined> {
		return fromPb(
			this.pb.collection('smurf_watch').getList<SmurfWatchRecord & { priority: number }>(1, 1, {
				filter: this.pb.filter('steam_id = {:steamId}', { steamId }),
				skipTotal: true
			}),
			'Could not load smurf watch'
		).map((rows) => rows.items[0]);
	}

	/**
	 * Queues an account for screening (or pulls it forward). Confirmed lenders
	 * (`resolved`) stay put so no Steam budget is spent on them again.
	 */
	enqueue({
		steamId,
		profileId,
		source,
		priority = SMURF_SOURCE_PRIORITY[source]
	}: {
		steamId: string;
		profileId: number | null;
		source: SmurfSource;
		priority?: number;
	}): Task<SmurfWatchRecord> {
		const now = new Date().toISOString();
		const liveSight = LIVE_SIGHTS.includes(source);
		const watch = this.pb.collection('smurf_watch');
		return this.findBySteamId(steamId).andThen((existing) => {
			if (!existing) {
				return fromPb(
					watch.create<SmurfWatchRecord>({
						steam_id: steamId,
						status: 'pending_screening',
						source,
						priority,
						check_interval_sec: 300,
						next_check_at: now,
						...(profileId !== null ? { profile_id: profileId } : {})
					}),
					'Could not queue smurf check'
				);
			}

			const reopen = liveSight && REOPENABLE.includes(existing.status);
			if (existing.status === 'resolved' || (existing.status === 'not_smurf' && !reopen)) {
				return okAsync<SmurfWatchRecord>(existing);
			}

			const patch: Record<string, unknown> = { next_check_at: now };
			const current = Number(existing.priority) || 0;
			if (priority > current || (liveSight && priority >= current)) {
				patch.priority = priority;
				patch.source = source;
			}

			if (profileId !== null && !existing.profile_id) {
				patch.profile_id = profileId;
			}

			if (reopen || (existing.status !== 'pending_screening' && existing.status !== 'watching')) {
				patch.status = 'pending_screening';
			}

			// Live re-sights extend the watching window.
			if (liveSight && existing.status === 'watching') {
				patch.watching_since = now;
			}

			return fromPb(
				watch.update<SmurfWatchRecord>(existing.id, patch),
				'Could not queue smurf check'
			);
		});
	}

	/** Someone saw who lends the account (live lobby, or staff): the case is closed. */
	markLender(input: {
		steamId: string;
		profileId: number | null;
		source: SmurfSource;
		lenderSteamId: string;
		lenderSource: string | null;
	}): Task<SmurfWatchRecord> {
		const data = {
			status: 'resolved',
			lender_steam_id: input.lenderSteamId,
			lender_source: input.lenderSource || 'live',
			smurf_score: 100,
			verdict: 'confirmed_shared',
			last_checked_at: new Date().toISOString(),
			next_check_at: null,
			...(input.profileId !== null ? { profile_id: input.profileId } : {})
		};
		const watch = this.pb.collection('smurf_watch');
		return this.findBySteamId(input.steamId).andThen((existing) =>
			fromPb(
				existing
					? watch.update<SmurfWatchRecord>(existing.id, data)
					: watch.create<SmurfWatchRecord>({
							...data,
							steam_id: input.steamId,
							source: input.source
						}),
				'Could not save lender'
			)
		);
	}

	/**
	 * Asks Steam who lends CoH to each player of a running game. The app's heartbeat
	 * proves they are in-game right now, so this does not depend on the worker seeing
	 * them online. Throttled per account; Steam failures are ignored.
	 */
	checkLiveLenders(players: { steamId: string; profileId: number | null }[]): Task<void> {
		const candidates = players.filter((player) => STEAM_ID.test(player.steamId));
		if (candidates.length === 0 || !this.steam.configured) {
			return okAsync(undefined);
		}

		const conditions = candidates.map((player) =>
			this.pb.filter('steam_id = {:steamId}', { steamId: player.steamId })
		);
		return sequence(anyOfChunks(conditions), (filter) =>
			fromPb(
				this.pb.collection('smurf_watch').getFullList<SmurfWatchRecord>({
					filter,
					fields: 'id,steam_id,status,last_live_check_at'
				}),
				'Could not load smurf watch'
			)
		)
			.map((chunks) => new Map(chunks.flat().map((record) => [record.steam_id, record])))
			.andThen((records) => {
				const threshold = Date.now() - LIVE_CHECK_INTERVAL_MS;
				const due = candidates.filter((player) => {
					const record = records.get(player.steamId);
					if (!record) {
						return true;
					}

					const lastCheck = Date.parse(record.last_live_check_at || '');
					return record.status !== 'resolved' && (Number.isNaN(lastCheck) || lastCheck < threshold);
				});
				return sequence(due, (player) => this.checkLiveLender(player, records.get(player.steamId)));
			})
			.map(() => undefined)
			.orElse((error) => {
				console.warn('[smurf] live lender check failed', error);
				return okAsync(undefined);
			});
	}

	private checkLiveLender(
		player: { steamId: string; profileId: number | null },
		record: SmurfWatchRecord | undefined
	): Task<void> {
		return this.steam
			.call('IPlayerService/IsPlayingSharedGame/v1', {
				steamid: player.steamId,
				appid_playing: COH_APP_ID
			})
			.andThen((data) => {
				const lender = String(
					(data as { response?: { lender_steamid?: unknown } })?.response?.lender_steamid ?? ''
				);
				if (STEAM_ID.test(lender) && lender !== player.steamId) {
					return this.markLender({
						steamId: player.steamId,
						profileId: player.profileId,
						source: 'lobby_live',
						lenderSteamId: lender,
						lenderSource: 'live'
					}).map(() => undefined);
				}

				return record
					? fromPb(
							this.pb
								.collection('smurf_watch')
								.update(record.id, { last_live_check_at: new Date().toISOString() }),
							'Could not save live check'
						).map(() => undefined)
					: okAsync(undefined);
			})
			.orElse(() => okAsync(undefined));
	}

	/** Work for the smurf worker: accounts due for screening, and watched accounts due a poll. */
	workerBatch(screeningLimit: number, pollingLimit: number) {
		const now = new Date().toISOString().replace('T', ' ');
		const due = this.pb.filter('(next_check_at = "" || next_check_at <= {:now})', { now });
		const screeningFilter = `(status = 'pending_screening' || status = 'unknown_private') && ${due}`;
		const pollingFilter = `status = 'watching' && ${due}`;
		const fields =
			'id,steam_id,profile_id,status,source,priority,check_interval_sec,owns_coh,watching_since';
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('smurf_watch').getList(1, screeningLimit, {
					filter: screeningFilter,
					sort: '-priority,next_check_at',
					fields
				}),
				'Could not load smurf screening batch'
			),
			fromPb(
				this.pb.collection('smurf_watch').getList(1, pollingLimit, {
					filter: pollingFilter,
					sort: '-priority,next_check_at',
					fields
				}),
				'Could not load smurf polling batch'
			)
		]).map(([screening, polling]) => ({
			screening: screening.items,
			polling: polling.items,
			fetched_at: new Date().toISOString(),
			total_pending: screening.totalItems,
			total_watching_due: polling.totalItems
		}));
	}

	/** The worker's findings for one account (only these fields). */
	workerUpdate(id: string, body: Record<string, unknown>) {
		const data = Object.fromEntries(
			WORKER_FIELDS.filter((field) => body[field] !== undefined).map((field) => [
				field,
				body[field]
			])
		);
		return ensure(Object.keys(data).length > 0, badRequest('Request body is required'))
			.asyncAndThen(() =>
				fromPb(
					this.pb.collection('smurf_watch').update<SmurfWatchRecord>(id, data),
					'Not found'
				).mapErr(() => notFound('Not found'))
			)
			.map((record) => ({
				id: record.id,
				steam_id: record.steam_id,
				status: record.status,
				lender_steam_id: record.lender_steam_id || null
			}));
	}

	/** Index rows (lobby, profile) matching any of the conditions, in filters that fit PocketBase's limit. */
	private indexRows(conditions: string[]): Task<IndexRow[]> {
		return sequence(anyOfChunks(conditions), (filter) =>
			fromPb(
				this.pb
					.collection('lobby_player_index')
					.getFullList<IndexRow>({ filter, fields: 'lobby,profile_id' }),
				'Could not load lobby players'
			)
		).map((pages) => pages.flat());
	}

	private rowsInLobbies(lobbyIds: string[]) {
		return this.indexRows(lobbyIds.map((lobby) => this.pb.filter('lobby = {:lobby}', { lobby })));
	}

	private lobbiesOf(profileIds: number[]) {
		return this.indexRows(
			profileIds.map((profileId) => this.pb.filter('profile_id = {:profileId}', { profileId }))
		);
	}

	/** Latest alias and Steam id seen for each profile (from the index). */
	private playerMeta(profileIds: number[]): Task<Map<number, PlayerMeta>> {
		return ResultAsync.combine(
			profileIds.map((profileId) =>
				fromPb(
					this.pb
						.collection('lobby_player_index')
						.getList<{ alias: string; steam_id: string }>(1, 1, {
							filter: this.pb.filter("profile_id = {:profileId} && alias != ''", { profileId }),
							sort: '-session_id',
							fields: 'alias,steam_id',
							skipTotal: true
						}),
					'Could not load lobby players'
				).map((rows): [number, PlayerMeta] => [
					profileId,
					{ alias: rows.items[0]?.alias || null, steam_id: rows.items[0]?.steam_id || null }
				])
			)
		).map((entries) => new Map(entries));
	}

	/** Teammates of the suspect: profile → lobbies played together, most first. */
	private directTeammates(profileId: number) {
		return this.lobbiesOf([profileId]).andThen((ownRows) => {
			const own = new Set(ownRows.map((row) => row.lobby));
			return this.rowsInLobbies([...own]).map((rows) => {
				const shared = new Map<number, Set<string>>();
				for (const row of rows) {
					if (row.profile_id !== profileId) {
						shared.set(row.profile_id, (shared.get(row.profile_id) ?? new Set()).add(row.lobby));
					}
				}
				const direct = [...shared].sort((a, b) => b[1].size - a[1].size || a[0] - b[0]);
				return { own, direct };
			});
		});
	}

	/** Accounts that played with at least two of the teammates, but never with the suspect. */
	private candidatesVia(profileId: number, own: Set<string>, direct: [number, Set<string>][]) {
		const directIds = new Set(direct.map(([id]) => id));
		const frequent = direct.slice(0, COPLAY_SECOND_ORDER_TEAMMATES).map(([id]) => id);
		return this.lobbiesOf(frequent).andThen((teammateLobbies) => {
			const teammatesOfLobby = new Map<string, Set<number>>();
			for (const row of teammateLobbies) {
				teammatesOfLobby.set(
					row.lobby,
					(teammatesOfLobby.get(row.lobby) ?? new Set()).add(row.profile_id)
				);
			}
			return this.rowsInLobbies(
				[...teammatesOfLobby.keys()].filter((lobby) => !own.has(lobby))
			).map((rows) => {
				const viaTeammates = new Map<number, Set<number>>();
				for (const row of rows) {
					if (row.profile_id === profileId || directIds.has(row.profile_id)) {
						continue;
					}

					for (const teammate of teammatesOfLobby.get(row.lobby) ?? []) {
						viaTeammates.set(
							row.profile_id,
							(viaTeammates.get(row.profile_id) ?? new Set()).add(teammate)
						);
					}
				}
				return [...viaTeammates]
					.filter(([, teammates]) => teammates.size >= 2)
					.sort((a, b) => b[1].size - a[1].size || a[0] - b[0]);
			});
		});
	}

	/**
	 * Who the suspect plays with, and accounts that share at least two of those
	 * teammates without ever playing with the suspect (the usual main-account
	 * pattern). The second step looks at the suspect's most frequent teammates only.
	 */
	coplay(profileId: number) {
		return this.directTeammates(profileId).andThen(({ own, direct }) =>
			this.candidatesVia(profileId, own, direct).andThen((candidates) => {
				const top = direct.slice(0, 25);
				const topCandidates = candidates.slice(0, 25);
				return this.playerMeta([...top.map(([id]) => id), ...topCandidates.map(([id]) => id)]).map(
					(meta) => ({
						profile_id: profileId,
						teammates: top.map(([id, lobbies]) => ({
							profile_id: id,
							...meta.get(id),
							shared_lobbies: lobbies.size
						})),
						candidates: topCandidates.map(([id, teammates]) => ({
							profile_id: id,
							...meta.get(id),
							shared_teammates: teammates.size
						}))
					})
				);
			})
		);
	}
}
