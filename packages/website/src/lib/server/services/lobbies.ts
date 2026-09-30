import type { RecordModel } from 'pocketbase';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { badRequest, forbidden, notFound, type AppError } from '../errors';
import { ensure, fromAsync, fromPb, pbMaybe, sequence, type Task } from '../result';
import { sameJson } from '../domain/json';
import {
	deriveLobby,
	type IndexRow,
	type LobbyDerivation,
	type StoredLobby
} from '../domain/lobby-derive';
import {
	MAX_REPLAY_BYTES,
	MIN_REPLAY_BYTES,
	lobbySteamIds,
	replayFileName,
	shouldReplaceReplay,
	type LobbyCreate,
	type LobbyUpdate
} from '../domain/lobby-writes';
import { Service } from './service';

type LobbyRecord = StoredLobby &
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

const matchNotFound = () => notFound('Match not found.');

function checkReplay(upload: ReplayUpload): Result<void, AppError> {
	if (upload.file.size < MIN_REPLAY_BYTES) {
		return err(badRequest('Replay file is empty or corrupt.'));
	}

	if (upload.file.size > MAX_REPLAY_BYTES) {
		return err(badRequest('Replay file is too large.'));
	}

	return ok(undefined);
}

type ReplayFields = { replay: File; replayBytes: number; replayDurationSeconds: number };
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

	/** The lobby as PocketBase returns it (apps expect `expand.user` by default). */
	view(id: string, { expand = 'user', fields }: RecordOptions = {}): Task<RecordModel> {
		return fromPb(
			this.lobbies.getOne(id, { expand: expand || undefined, fields }),
			'Match not found.'
		);
	}

	bySession(sessionId: number): Task<LobbyRecord | undefined> {
		return fromPb(
			this.lobbies.getList<LobbyRecord>(1, 1, {
				filter: this.pb.filter('sessionId = {:sessionId}', { sessionId }),
				skipTotal: true
			}),
			'Could not load match'
		).map((rows) => rows.items[0]);
	}

	/** Replaces the lobby's index rows in one transaction, touching only rows that changed. */
	private syncIndex(lobbyId: string, rows: IndexRow[]): Task<void> {
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
				? fromPb(batch.send(), 'Could not update lobby players').map(() => undefined)
				: okAsync(undefined);
		});
	}

	/** Every signed-up player in the match earns "match played" once per lobby. */
	private awardMatchPlayed(lobbyId: string, steamIds: string[]): Task<void> {
		if (steamIds.length === 0) {
			return okAsync(undefined);
		}

		const reputation = this.services.reputation;
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('users').getFullList<{ id: string }>({
					filter: steamIds
						.map((steamId) => this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }))
						.join(' || '),
					fields: 'id'
				}),
				'Could not load users'
			),
			reputation.awardedFor('match_played', lobbyId)
		])
			.andThen(([users, awarded]) =>
				sequence(
					users.filter((user) => !awarded.has(user.id)),
					(user) => reputation.award(user.id, 'match_played', lobbyId)
				)
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
					.andThen(() => this.awardMatchPlayed(lobbyId, derived.steamIds))
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

	/** The lobby for a Relic session: the existing one, or a new one owned by `userId`. */
	ensure(userId: string, input: LobbyCreate): Task<{ id: string; created: boolean }> {
		return this.bySession(input.sessionId).andThen((existing) => {
			if (existing) {
				return okAsync({ id: existing.id, created: false });
			}

			return fromPb(
				this.lobbies.create<{ id: string }>({ ...input, user: userId }),
				'Could not create match'
			)
				.map((record) => ({ id: record.id, created: true }))
				.orElse((error) =>
					// Lost a race on the unique sessionId index: the other request created it.
					error.status === 400
						? this.bySession(input.sessionId).andThen((raced) =>
								raced ? ok({ id: raced.id, created: false }) : err(error)
							)
						: errAsync(error)
				)
				.andThen((lobby) =>
					lobby.created
						? this.process(lobby.id, { created: true }).map(() => lobby)
						: okAsync(lobby)
				);
		});
	}

	/** Owner, a player in the match (by Steam id), or someone whose live lobby points at it. */
	private isParticipant(lobby: LobbyRecord, userId: string): Task<boolean> {
		if (lobby.user === userId) {
			return okAsync(true);
		}

		return fromPb(
			this.pb.collection('users').getOne<{ steamIds: unknown }>(userId, { fields: 'steamIds' }),
			'User not found'
		).andThen((user) => {
			const own = new Set(Array.isArray(user.steamIds) ? user.steamIds.map(String) : []);
			if (lobbySteamIds(lobby.players).some((steamId) => own.has(steamId))) {
				return okAsync(true);
			}

			return fromPb(
				this.pb.collection('lobbies_live').getList(1, 1, {
					filter: this.pb.filter('user = {:userId} && lobby = {:lobbyId}', {
						userId,
						lobbyId: lobby.id
					}),
					fields: 'id',
					skipTotal: true
				}),
				'Could not load live lobby'
			).map((live) => live.items.length > 0);
		});
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

	/** The replay fields to save, or null when the stored replay is better. */
	private replayFields(lobby: LobbyRecord, upload: ReplayUpload): Task<ReplayFields | null> {
		const seconds = Math.max(0, Math.floor(upload.seconds || 0));
		return this.storedReplayBytes(lobby).map((bytes) => {
			const keep = !shouldReplaceReplay(
				{ bytes: upload.file.size, seconds },
				{ bytes, seconds: Number(lobby.replayDurationSeconds) || 0 }
			);
			if (keep) {
				return null;
			}

			const file = new File([upload.file], replayFileName(upload.file.name || ''), {
				type: 'application/octet-stream'
			});
			return { replay: file, replayBytes: upload.file.size, replayDurationSeconds: seconds };
		});
	}

	/** Owners may change anything; other participants only offer a replay. */
	private checkUpdater(lobby: LobbyRecord, userId: string, hasReplay: boolean): Task<void> {
		if (lobby.user === userId) {
			return okAsync(undefined);
		}

		if (!hasReplay) {
			return errAsync(forbidden('Only the match owner can update this match.'));
		}

		return this.isParticipant(lobby, userId).andThen((participant) =>
			ensure(participant, forbidden('Only match participants can update this match.'))
		);
	}

	/**
	 * Owner: updates the match (and optionally its replay). Other participants may
	 * only offer a replay, which is kept when it is longer or larger.
	 */
	update(id: string, userId: string, input: LobbyUpdate, replay?: ReplayUpload): Task<void> {
		return this.load(id).andThen((lobby) =>
			this.checkUpdater(lobby, userId, !!replay)
				.andThen(() => (replay ? checkReplay(replay) : ok(undefined)))
				.andThen(() => (replay ? this.replayFields(lobby, replay) : okAsync(null)))
				.andThen((fields) => {
					const patch: Record<string, unknown> = {
						...(lobby.user === userId ? input : {}),
						...(fields ?? {})
					};
					if (Object.keys(patch).length === 0) {
						return okAsync(undefined);
					}

					return fromPb(this.lobbies.update(id, patch), 'Could not update match')
						.andThen(() => this.process(id))
						.map(() => undefined);
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
