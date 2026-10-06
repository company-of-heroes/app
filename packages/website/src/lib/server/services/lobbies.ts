import type { RecordModel } from 'pocketbase';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { badRequest, forbidden, notFound, upstream, type AppError } from '../errors';
import { ensure, fromAsync, fromPb, pbMaybe, sequence, type Task } from '../result';
import { sameJson } from '../domain/json';
import { publicRecord } from '../domain/public-record';
import {
	deriveLobby,
	TRANSLATED_TITLES,
	type IndexRow,
	type LobbyDerivation,
	type StoredLobby
} from '../domain/lobby-derive';
import {
	MAX_REPLAY_BYTES,
	MIN_REPLAY_BYTES,
	lobbySteamIds,
	missingLobbyFields,
	replayFileName,
	shouldReplaceReplay,
	type LobbyCreate,
	type LobbyUpdate
} from '../domain/lobby-writes';
import { replayHasAi, SKIRMISH_FIELDS } from '../domain/replay-skirmish';
import { summarizeReplay } from '../domain/replay-summary';
import type { ReplaySummary } from '@company-of-heroes/ui/statistics/types';
import { Service } from './service';

export type LobbyRecord = StoredLobby &
	Record<string, unknown> & {
		id: string;
		collectionId: string;
		user: string;
		replay: string;
		replayBytes: number;
		replayDurationSeconds: number;
	};
export type RecordOptions = { expand?: string; fields?: string };
export type ReplayUpload = { file: File; seconds: number };
export type AttachReplayResult = {
	id: string;
	attached: boolean;
	keptExisting: boolean;
	replaySize: number;
	replayDurationSeconds: number;
};

type StoredIndexRow = {
	[K in keyof IndexRow]: IndexRow[K] extends number | null ? number : IndexRow[K];
} & { id: string };

/** PocketBase stores an empty number as 0. */
const stored = (value: unknown) => (value === null || value === undefined ? 0 : value);

function sameRow(existing: StoredIndexRow, next: IndexRow): boolean {
	return (Object.keys(next) as (keyof IndexRow)[]).every((key) =>
		typeof next[key] === 'string' || typeof next[key] === 'boolean'
			? existing[key] === next[key]
			: stored(existing[key]) === stored(next[key])
	);
}

/** Only the derived columns whose value actually changes (PocketBase returns JSON with sorted keys). */
function changedColumns(
	lobby: StoredLobby & Record<string, unknown>,
	columns: LobbyDerivation['columns']
) {
	return Object.fromEntries(
		Object.entries(columns).filter(([key, value]) => !sameJson(lobby[key] ?? null, value))
	);
}

const SETTLED_FIELDS = new Set(['players', 'map', 'isRanked']);

/**
 * What the owner may change. Once Relic's result is in, the players, map and ranked flag
 * are settled: a late write (e.g. from the next game under a stale session id) must not
 * pair another game's roster with this result.
 */
function ownerFields(
	lobby: LobbyRecord,
	fields: Omit<LobbyUpdate, 'needsResult'>
): Partial<LobbyUpdate> {
	if (!lobby.result) {
		return fields;
	}

	return Object.fromEntries(Object.entries(fields).filter(([key]) => !SETTLED_FIELDS.has(key)));
}

const matchNotFound = () => notFound('Match not found.');
/** Duplicate sessions merged per scheduled run. */
const MERGE_BATCH = 10;
/** Duplicate sessions looked at per run, so sessions that keep failing do not block the rest. */
const MERGE_SCAN = 100;
/** Lobbies re-derived per `reprocessStale` run. */
const REPROCESS_BATCH = 50;
/** Index rows scanned per `repairStaleIndex` run (several rows per lobby). */
const INDEX_REPAIR_SCAN = 200;
/** Stored replays downloaded and checked for AI per `markReplaySkirmishes` run. */
const SKIRMISH_SCAN_BATCH = 25;
/** Stored replays fully parsed per `summarizeReplays` run (a parse costs ~10-100 ms CPU). */
const REPLAY_STATS_BATCH = 8;

function checkReplay(upload: ReplayUpload): Result<void, AppError> {
	if (upload.file.size < MIN_REPLAY_BYTES) {
		return err(badRequest('Replay file is empty or corrupt.'));
	}

	if (upload.file.size > MAX_REPLAY_BYTES) {
		return err(badRequest('Replay file is too large.'));
	}

	return ok(undefined);
}

type ReplayFields = {
	replay: File;
	replayBytes: number;
	replayDurationSeconds: number;
	/** Cleared so the `replay-stats` job summarizes the new file. */
	replayStats: null;
} & Partial<typeof SKIRMISH_FIELDS>;
/**
 * Lobbies (durable match records) and their write pipeline. Every write ends in
 * `process`, which brings everything derived from the lobby up to date; it is
 * idempotent, so it can also be re-run at any time.
 */
export class LobbiesService extends Service {
	private get lobbies() {
		return this.pb.collection('lobbies');
	}

	private load(id: string): Task<LobbyRecord> {
		return pbMaybe(this.lobbies.getOne<LobbyRecord>(id)).andThen((lobby) =>
			lobby ? ok(lobby) : err(matchNotFound())
		);
	}

	/**
	 * The lobby as PocketBase returns it (apps expect `expand.user` by default), with
	 * expanded accounts reduced to their public fields.
	 */
	view(id: string, { expand = 'user', fields }: RecordOptions = {}): Task<RecordModel> {
		return fromPb(
			this.lobbies.getOne(id, { expand: expand || undefined, fields }),
			'Match not found.'
		).map(publicRecord);
	}

	/** The session's lobby; the oldest one if a race ever created more. */
	bySession(sessionId: number): Task<LobbyRecord | undefined> {
		return fromPb(
			this.lobbies.getList<LobbyRecord>(1, 1, {
				filter: this.pb.filter('sessionId = {:sessionId}', { sessionId }),
				sort: 'createdAt,id',
				skipTotal: true
			}),
			'Could not load match'
		).map((rows) => rows.items[0]);
	}

	/**
	 * Replaces the lobby's index rows in one transaction, touching only rows that changed.
	 * Resolves whether anything changed.
	 */
	private syncIndex(lobbyId: string, rows: IndexRow[]): Task<boolean> {
		return fromPb(
			this.pb.collection('lobby_player_index').getFullList<StoredIndexRow>({
				filter: this.pb.filter('lobby = {:lobbyId}', { lobbyId })
			}),
			'Could not load lobby players'
		).andThen((existing) => {
			const batch = this.pb.createBatch();
			let writes = 0;
			const kept = new Set<string>();
			for (const row of rows) {
				const match = existing.find(
					(item) => item.profile_id === row.profile_id && !kept.has(item.id)
				);
				if (match) {
					kept.add(match.id);
					if (!sameRow(match, row)) {
						batch.collection('lobby_player_index').update(match.id, row);
						writes++;
					}
				} else {
					batch.collection('lobby_player_index').create(row);
					writes++;
				}
			}
			for (const item of existing) {
				if (!kept.has(item.id)) {
					batch.collection('lobby_player_index').delete(item.id);
					writes++;
				}
			}
			return writes > 0
				? fromPb(batch.send(), 'Could not update lobby players').map(() => true)
				: okAsync(false);
		});
	}

	/**
	 * Every signed-up player in the match earns "match played" once per lobby. When the
	 * index rows changed (e.g. a result came in), the players are queued for rewards.
	 */
	private awardMatchPlayed(lobbyId: string, steamIds: string[], indexChanged: boolean): Task<void> {
		if (steamIds.length === 0) {
			return okAsync(undefined);
		}

		const { reputation, rewards } = this.services;
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('users').getFullList<{ id: string; rewardsCheckedAt: string }>({
					filter: steamIds
						.map((steamId) => this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }))
						.join(' || '),
					fields: 'id,rewardsCheckedAt'
				}),
				'Could not load users'
			),
			reputation.awardedFor('match_played', lobbyId)
		])
			.andThen(([users, awarded]) =>
				sequence(
					users.filter((user) => !awarded.has(user.id)),
					(user) => reputation.award(user.id, 'match_played', lobbyId)
				).andThen(() => rewards.markDirty(indexChanged ? users : []))
			)
			.map(() => undefined);
	}

	/**
	 * Derives the lobby's columns, index rows, ratings and reputation.
	 * `created`: first time this lobby is processed (queues its players for smurf screening).
	 */
	process(lobbyId: string, { created = false } = {}): Task<LobbyDerivation> {
		const { hiddenMatches, ratings, smurf } = this.services;
		return ResultAsync.combine([this.load(lobbyId), hiddenMatches.rules()]).andThen(
			([lobby, rules]) => {
				const derived = deriveLobby(lobby, rules);
				const changes = changedColumns(lobby, derived.columns);
				const saved: Task<unknown> =
					Object.keys(changes).length > 0
						? fromPb(this.lobbies.update(lobbyId, changes), 'Could not update match')
						: okAsync(undefined);
				return saved
					.andThen(() => this.syncIndex(lobbyId, derived.indexRows))
					.andThen((indexChanged) => this.awardMatchPlayed(lobbyId, derived.steamIds, indexChanged))
					.andThen(() => ratings.apply(derived.ratings))
					.andThen(() =>
						sequence(created ? derived.smurfCandidates : [], (candidate) =>
							smurf.enqueue({ ...candidate, source: 'lobby_match' })
						)
					)
					.map(() => derived);
			}
		);
	}

	/** Saves what `input` adds to the lobby (fields it is still missing); filled fields stay. */
	private fill(lobby: LobbyRecord, input: LobbyUpdate): Task<void> {
		const patch = missingLobbyFields(lobby, input);
		if (Object.keys(patch).length === 0) {
			return okAsync(undefined);
		}

		return fromPb(this.lobbies.update(lobby.id, patch), 'Could not update match')
			.andThen(() => this.process(lobby.id))
			.map(() => undefined);
	}

	/**
	 * The lobby for a Relic session: the existing one (filled with what it is missing),
	 * or a new one owned by `userId`.
	 */
	ensure(userId: string, input: LobbyCreate): Task<{ id: string; created: boolean }> {
		const { sessionId, ...fields } = input;
		const joinExisting = (lobby: LobbyRecord) =>
			this.isParticipant(lobby, userId, fields.players)
				.andThen((participant) => (participant ? this.fill(lobby, fields) : okAsync(undefined)))
				.map(() => ({ id: lobby.id, created: false }));
		return this.bySession(sessionId).andThen((existing) => {
			if (existing) {
				return joinExisting(existing);
			}

			return fromPb(
				this.lobbies.create<{ id: string }>({ ...input, user: userId }),
				'Could not create match'
			).andThen(({ id }) =>
				// Players in the same match start it at the same moment and `sessionId` is not
				// unique, so both may have created a row. The oldest wins; the others merge into it.
				this.bySession(sessionId).andThen((oldest) =>
					oldest && oldest.id !== id
						? fromPb(this.lobbies.delete(id), 'Could not create match').andThen(() =>
								joinExisting(oldest)
							)
						: this.process(id, { created: true }).map(() => ({ id, created: true }))
				)
			);
		});
	}

	/** The loser's replay as the keeper's new one, when it is longer (or larger). */
	private betterReplay(keeper: LobbyRecord, loser: LobbyRecord): Task<Partial<ReplayFields>> {
		if (!loser.replay) {
			return okAsync({});
		}

		return ResultAsync.combine([
			this.storedReplayBytes(keeper),
			this.storedReplayBytes(loser)
		]).andThen(([keeperBytes, loserBytes]) => {
			const better = shouldReplaceReplay(
				{ bytes: loserBytes, seconds: Number(loser.replayDurationSeconds) || 0 },
				{ bytes: keeperBytes, seconds: Number(keeper.replayDurationSeconds) || 0 }
			);
			if (!better) {
				return okAsync({});
			}

			return fromAsync(
				this.fileFetch(this.pb.files.getURL(loser, loser.replay)).then((response) => {
					if (!response.ok) {
						throw new Error(`replay download failed (${response.status})`);
					}

					return response.arrayBuffer();
				}),
				'Could not copy the replay',
				502
			).map((bytes) => ({
				replay: new File([bytes], replayFileName(loser.replay), {
					type: 'application/octet-stream'
				}),
				replayBytes: bytes.byteLength,
				replayDurationSeconds: Number(loser.replayDurationSeconds) || 0,
				replayStats: null
			}));
		});
	}

	/**
	 * Merges a duplicate into the keeper: fields the keeper is missing, a better replay,
	 * and everything pointing at the duplicate (likes, comments, live lobbies, reputation).
	 * The duplicate is deleted only once nothing is left pointing at it.
	 */
	private mergeInto(keeperId: string, loser: LobbyRecord): Task<void> {
		return this.load(keeperId)
			.andThen((keeper) =>
				this.betterReplay(keeper, loser).andThen((replay) => {
					const patch = {
						...missingLobbyFields(keeper, loser as LobbyUpdate),
						...(keeper.needsResult && !loser.needsResult && loser.result
							? { result: loser.result, needsResult: false }
							: {}),
						...(!keeper.memberReplay && loser.memberReplay
							? { memberReplay: loser.memberReplay }
							: {}),
						...replay
					};
					return Object.keys(patch).length > 0
						? fromPb(this.lobbies.update(keeperId, patch), 'Could not update match')
						: okAsync(undefined);
				})
			)
			.andThen(() =>
				// The index rows are rebuilt by `process`; the loser's go with it (cascade).
				this.services.relations.move(loser.collectionId, loser.id, keeperId, ['lobby_player_index'])
			)
			.andThen((failed) =>
				failed === 0
					? this.services.reputation
							.moveSource(loser.id, keeperId)
							.andThen(() => fromPb(this.lobbies.delete(loser.id), 'Could not delete match'))
							.map(() => undefined)
					: errAsync(upstream(`Could not move ${failed} rows of match ${loser.id}`))
			);
	}

	/** Merges one session's lobbies into its oldest. */
	private mergeSession(sessionId: number): Task<void> {
		return fromPb(
			this.lobbies.getFullList<LobbyRecord>({
				filter: this.pb.filter('sessionId = {:sessionId}', { sessionId }),
				sort: 'createdAt,id'
			}),
			'Could not load matches'
		).andThen(([keeper, ...losers]) =>
			sequence(losers, (loser) => this.mergeInto(keeper.id, loser))
				.andThen(() => this.process(keeper.id))
				.andThen(() => this.services.social.recount({ kind: 'lobby', id: keeper.id }))
				.map(() => undefined)
		);
	}

	/** Merges sessions in order until `MERGE_BATCH` succeeded; failures are logged and skipped. */
	private mergeSessions(sessionIds: number[], merged = 0): Task<number> {
		const [sessionId, ...rest] = sessionIds;
		if (sessionId === undefined || merged >= MERGE_BATCH) {
			return okAsync(merged);
		}

		return this.mergeSession(sessionId)
			.map(() => 1)
			.orElse((error) => {
				console.error(`[lobbies] could not merge session ${sessionId}`, error);
				return okAsync(0);
			})
			.andThen((n) => this.mergeSessions(rest, merged + n));
	}

	/**
	 * Scheduled: re-derives finished lobbies whose stored ranked
	 * flag or title disagrees with Relic's result (Basic Matches saved as ranked or titled
	 * "2 VS. 2", skirmishes under another title, titles saved translated). A processed lobby no longer matches the filter.
	 */
	reprocessStale(): Task<{ processed: number; more: boolean }> {
		const translated = [...TRANSLATED_TITLES.keys()].map((title) =>
			this.pb.filter('title = {:title}', { title })
		);
		const filter = [
			'(needsResult = false && result != null && (',
			'(isRanked = true && (matchtypeId = 0 || matchtypeId >= 8)) ||',
			'(isRanked = false && matchtypeId >= 1 && matchtypeId <= 7) ||',
			"(isRanked = false && (title = '1 VS. 1' || title = '2 VS. 2' || title = '3 VS. 3' || title = '4 VS. 4')) ||",
			"(matchtypeId = 14 && title != 'Skirmish')",
			`)) || ${translated.join(' || ')}`
		].join(' ');
		return fromPb(
			this.lobbies.getList<{ id: string }>(1, REPROCESS_BATCH, {
				filter,
				sort: 'id',
				fields: 'id'
			}),
			'Could not load matches'
		).andThen((rows) =>
			sequence(rows.items, (row) => this.process(row.id)).map(() => ({
				processed: rows.items.length,
				more: rows.totalItems > rows.items.length
			}))
		);
	}

	/**
	 * One-time (run by hand until done): lobbies whose index rows were written before
	 * Relic's result came in and never rebuilt (no Steam id, outcome/race/type stored as 0),
	 * so performance counted them as lost Basic Matches. Walks lobby ids after `after`.
	 */
	repairStaleIndex(after = ''): Task<{ processed: number; more: boolean; after: string }> {
		return fromPb(
			this.pb.collection('lobby_player_index').getList<{ lobby: string }>(1, INDEX_REPAIR_SCAN, {
				filter: this.pb.filter(
					"lobby > {:after} && lobby.result != null && steam_id = '' && outcome = 0 && race_id = 0 && matchtype_id = 0",
					{ after }
				),
				sort: 'lobby',
				fields: 'lobby'
			}),
			'Could not load lobby players'
		).andThen((rows) => {
			const lobbyIds = [...new Set(rows.items.map((row) => row.lobby))];
			return sequence(lobbyIds, (id) =>
				this.process(id)
					.map(() => 1)
					.orElse((error) => {
						console.error(`[lobbies] could not reprocess ${id}`, error);
						return okAsync(0);
					})
			).map((done) => ({
				processed: done.reduce((sum, n) => sum + n, 0),
				more: rows.totalItems > rows.items.length,
				after: lobbyIds.at(-1) ?? after
			}));
		});
	}

	/**
	 * One-time (run by hand until done): lobbies without a Relic result whose stored replay
	 * has AI players become skirmishes. Walks ids after `after`; feed back the returned cursor.
	 */
	markReplaySkirmishes(after = ''): Task<{ processed: number; more: boolean; after: string }> {
		return fromPb(
			this.lobbies.getList<LobbyRecord>(1, SKIRMISH_SCAN_BATCH, {
				filter: this.pb.filter(
					"replay != '' && result = null && title != 'Skirmish' && id > {:after}",
					{ after }
				),
				sort: 'id',
				fields: 'id,collectionId,replay,result,title'
			}),
			'Could not load matches'
		).andThen((rows) =>
			sequence(rows.items, (lobby) => this.markReplaySkirmish(lobby)).map((marked) => ({
				processed: marked.filter(Boolean).length,
				more: rows.totalItems > rows.items.length,
				after: rows.items.at(-1)?.id ?? after
			}))
		);
	}

	/** Downloads the stored replay; true when it made the lobby a skirmish. Failures are skipped. */
	private markReplaySkirmish(lobby: LobbyRecord): Task<boolean> {
		return fromAsync(
			this.fileFetch(this.pb.files.getURL(lobby, lobby.replay)),
			'Could not download replay',
			502
		)
			.andThen((response) =>
				response.ok
					? fromAsync(response.arrayBuffer(), 'Could not read replay', 502)
					: errAsync(upstream('Could not download replay'))
			)
			.andThen((bytes) =>
				replayHasAi(bytes)
					? fromPb(this.lobbies.update(lobby.id, SKIRMISH_FIELDS), 'Could not update match')
							.andThen(() => this.process(lobby.id))
							.map(() => true)
					: okAsync(false)
			)
			.orElse((error) => {
				console.error(`[lobbies] could not check replay of ${lobby.id}`, error);
				return okAsync(false);
			});
	}

	/**
	 * Scheduled: summarizes stored replays that have no `replayStats` yet (doctrines, units,
	 * upgrades, openings for community statistics). A replay that cannot be downloaded gets an
	 * empty summary with version 0, so it does not block the queue.
	 */
	summarizeReplays(): Task<{ processed: number; more: boolean }> {
		return fromPb(
			this.lobbies.getList<LobbyRecord>(1, REPLAY_STATS_BATCH, {
				filter: "replay != '' && replayStats = null",
				sort: 'id',
				fields: 'id,collectionId,replay'
			}),
			'Could not load matches'
		).andThen((rows) =>
			sequence(rows.items, (lobby) => this.summarizeStoredReplay(lobby)).map((done) => ({
				processed: done.length,
				more: rows.totalItems > rows.items.length
			}))
		);
	}

	private summarizeStoredReplay(lobby: LobbyRecord): Task<void> {
		return fromAsync(
			this.fileFetch(this.pb.files.getURL(lobby, lobby.replay)),
			'Could not download replay',
			502
		)
			.andThen((response) =>
				response.ok
					? fromAsync(response.arrayBuffer(), 'Could not read replay', 502)
					: errAsync(upstream('Could not download replay'))
			)
			.map((bytes): ReplaySummary => summarizeReplay(bytes))
			.orElse((error) => {
				console.error(`[lobbies] could not summarize replay of ${lobby.id}`, error);
				return okAsync<ReplaySummary>({ v: 0, players: [] });
			})
			.andThen((replayStats) =>
				fromPb(this.lobbies.update(lobby.id, { replayStats }), 'Could not update match')
			)
			.map(() => undefined);
	}

	/**
	 * Scheduled: Relic sessions with more than one lobby are merged into their oldest,
	 * newest sessions first. A session that keeps failing is skipped, so it cannot hold
	 * up the others.
	 */
	mergeDuplicates(): Task<{ processed: number; more: boolean }> {
		return fromPb(
			this.pb
				.collection('lobby_session_duplicates')
				.getList<{ id: string }>(1, MERGE_SCAN, { sort: '-id', skipTotal: true }),
			'Could not load duplicate matches'
		).andThen((rows) =>
			this.mergeSessions(rows.items.map((row) => Number(row.id)).filter((id) => id > 0)).map(
				(processed) => ({ processed, more: processed >= MERGE_BATCH })
			)
		);
	}

	/**
	 * The owner, or a player in the match by one of the user's Steam ids. A lobby without
	 * players yet also accepts someone who is in `players` (what they report).
	 */
	isParticipant(
		lobby: Pick<LobbyRecord, 'user' | 'players'>,
		userId: string,
		players?: unknown
	): Task<boolean> {
		if (lobby.user === userId) {
			return okAsync(true);
		}

		const stored = lobbySteamIds(lobby.players);
		const listed = stored.length > 0 ? stored : lobbySteamIds(players);
		if (listed.length === 0) {
			return okAsync(false);
		}

		return this.services.users
			.steamIdsOf(userId)
			.map((own) => listed.some((steamId) => own.includes(steamId)));
	}

	/** Size of the stored replay: `replayBytes`, or the file itself for rows from before that column. */
	private storedReplayBytes(lobby: LobbyRecord): Task<number> {
		if (Number(lobby.replayBytes) > 0) {
			return okAsync(Number(lobby.replayBytes));
		}

		if (!lobby.replay) {
			return okAsync(0);
		}

		return fromAsync(
			this.fileFetch(this.pb.files.getURL(lobby, lobby.replay), { method: 'HEAD' }),
			'Could not check the stored replay',
			502
		).map((response) => (response.ok ? Number(response.headers.get('content-length')) || 0 : 0));
	}

	/**
	 * The replay fields to save, or null when the stored replay is better. A replay with
	 * AI players makes a lobby without Relic result a skirmish (the game log can miss it).
	 */
	private replayFields(lobby: LobbyRecord, upload: ReplayUpload): Task<ReplayFields | null> {
		const seconds = Math.max(0, Math.floor(upload.seconds || 0));
		return this.storedReplayBytes(lobby).andThen((bytes) => {
			const keep = !shouldReplaceReplay(
				{ bytes: upload.file.size, seconds },
				{ bytes, seconds: Number(lobby.replayDurationSeconds) || 0 }
			);
			if (keep) {
				return okAsync(null);
			}

			const file = new File([upload.file], replayFileName(upload.file.name || ''), {
				type: 'application/octet-stream'
			});
			return this.skirmishFields(lobby, upload.file).map((skirmish) => ({
				replay: file,
				replayBytes: upload.file.size,
				replayDurationSeconds: seconds,
				replayStats: null,
				...skirmish
			}));
		});
	}

	/** `SKIRMISH_FIELDS` when the lobby has no Relic result yet and the replay has AI players. */
	private skirmishFields(lobby: LobbyRecord, replay: Blob): Task<Partial<typeof SKIRMISH_FIELDS>> {
		if (lobby.result || lobby.title === 'Skirmish') {
			return okAsync({});
		}

		return fromAsync(replay.arrayBuffer(), 'Could not read replay', 400).map((bytes) =>
			replayHasAi(bytes) ? SKIRMISH_FIELDS : {}
		);
	}

	/** Owners may change anything; other participants only add what is missing. */
	private checkUpdater(lobby: LobbyRecord, userId: string): Task<void> {
		if (lobby.user === userId) {
			return okAsync(undefined);
		}

		return this.isParticipant(lobby, userId).andThen((participant) =>
			ensure(participant, forbidden('Only match participants can update this match.'))
		);
	}

	/**
	 * Owner: updates the match (and optionally its replay). Other participants may
	 * fill fields the match is still missing and offer a replay, which is kept when
	 * it is longer or larger. The result always comes from Relic: `needsResult: false`
	 * asks the server to look it up now (a skirmish has none and is just finished), and
	 * the owner's `needsResult: true` starts the lookup over.
	 */
	update(id: string, userId: string, input: LobbyUpdate, replay?: ReplayUpload): Task<void> {
		const { needsResult, ...fields } = input;
		return this.load(id).andThen((lobby) =>
			this.checkUpdater(lobby, userId)
				.andThen(() => (replay ? checkReplay(replay) : ok(undefined)))
				.andThen(() => (replay ? this.replayFields(lobby, replay) : okAsync(null)))
				.andThen((replayFields) => {
					const owner = lobby.user === userId;
					const skirmish =
						replayFields?.title === 'Skirmish' || (fields.title ?? lobby.title) === 'Skirmish';
					const patch: Record<string, unknown> = {
						...(owner ? ownerFields(lobby, fields) : missingLobbyFields(lobby, fields)),
						...(owner && needsResult === false && skirmish ? { needsResult: false } : {}),
						...(owner && needsResult === true && !lobby.needsResult && !lobby.result && !skirmish
							? { needsResult: true, hasFailed: false, resultAttempts: 0 }
							: {}),
						...(replayFields ?? {})
					};
					const saved =
						Object.keys(patch).length === 0
							? okAsync(undefined)
							: fromPb(this.lobbies.update(id, patch), 'Could not update match')
									.andThen(() => this.process(id))
									.map(() => undefined);
					return needsResult === false && lobby.needsResult && !skirmish
						? saved.andThen(() =>
								// Best effort: the scheduled fill catches up when Relic is slow.
								this.services.matchResults.fillOne(id).orElse(() => okAsync(undefined))
							)
						: owner && needsResult === true && !skirmish
							? saved.andThen(() => this.reopenResultFill(id))
							: saved;
				})
		);
	}

	/** Any participant may attach their replay; the longer (or larger) file wins. */
	attachReplay(id: string, userId: string, upload: ReplayUpload): Task<AttachReplayResult> {
		return checkReplay(upload)
			.asyncAndThen(() => this.load(id))
			.andThen((lobby) =>
				this.isParticipant(lobby, userId)
					.andThen((participant) =>
						ensure(participant, forbidden('Only match participants can attach a replay.'))
					)
					.andThen(() => this.replayFields(lobby, upload))
					.andThen((fields) => {
						if (!fields) {
							return this.storedReplayBytes(lobby).map((replaySize) => ({
								id,
								attached: false,
								keptExisting: true,
								replaySize,
								replayDurationSeconds: Number(lobby.replayDurationSeconds) || 0
							}));
						}

						return fromPb(this.lobbies.update(id, fields), 'Could not attach replay')
							.andThen(() => this.process(id))
							.map(() => ({
								id,
								attached: true,
								keptExisting: false,
								replaySize: fields.replayBytes,
								replayDurationSeconds: fields.replayDurationSeconds
							}));
					})
			);
	}

	/** Only the owner deletes a match; its index rows go with it (cascade). */
	remove(id: string, userId: string): Task<void> {
		return this.load(id)
			.andThen((lobby) => ensure(lobby.user === userId, matchNotFound()))
			.andThen(() => fromPb(this.lobbies.delete(id), 'Could not delete match'))
			.map(() => undefined);
	}

	/** Result fill starts over once the game has ended (attempts made while it was live do not count). */
	reopenResultFill(id: string): Task<void> {
		return this.load(id)
			.orElse(() => ok(null))
			.andThen((lobby) =>
				lobby?.needsResult && (lobby.hasFailed || Number(lobby.resultAttempts) > 0)
					? fromPb(
							this.lobbies.update(id, { hasFailed: false, resultAttempts: 0 }),
							'Could not update match'
						).map(() => undefined)
					: okAsync(undefined)
			);
	}
}
