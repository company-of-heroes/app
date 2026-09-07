import { ClientResponseError, type ListResult, type RecordSubscription, type UnsubscribeFunc } from 'pocketbase';
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import {
	isOccupiedLobbySlot,
	toLiveLobbyRecord,
	type LiveLobbyRecord
} from '@company-of-heroes/ui/live-lobby/slim';
import {
	attachLiveLobbyStats,
	type LiveLobbyRawPlayer
} from '@company-of-heroes/ui/live-lobby/stats';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fromPbPromise, pbOptions, requireAuth } from '../pb';

export type { LiveLobbyRecord };

/** Drop orphaned rows when the game exits without a DESTROYED log (Alt+F4 / Exit to Windows).
 * Keep in sync with packages/pocketbase/pb_hooks/lib/lobbies-live.js */
export const LOBBIES_LIVE_STALE_MS = 30 * 60 * 1000;
/** How often an active match refreshes updatedAt so long games aren't pruned. */
export const LOBBIES_LIVE_HEARTBEAT_MS = 2 * 60 * 1000;

const LIST_LIMIT = 48;

export type LiveLobbyWritePlayer = Record<string, unknown> & {
	steamId?: string;
	storedElo?: unknown;
	matchHistory?: unknown[];
	playerId?: number;
	type?: number;
};

export type LiveLobbyWriteInput = {
	sessionId: number;
	map: string;
	isRanked: boolean;
	isReplay?: boolean;
	matchType?: number | null;
	players: LiveLobbyWritePlayer[];
	lobby?: string | null;
};

type CollectionLobby = {
	id: string;
	sessionId?: number | string;
	map?: string;
	isRanked?: boolean;
	isReplay?: boolean;
	matchType?: number | null;
	createdAt?: string;
	updatedAt?: string;
	lobby?: string;
	players?: unknown;
	expand?: { user?: { name?: string; email?: string } };
};

export type LiveLobbyRow = CollectionLobby & {
	user?: string;
	players: LiveLobbyWritePlayer[];
};

/** PocketBase filter: only rows touched within the stale window. */
export function lobbiesLiveFreshFilter(now = Date.now()): string {
	const since = new Date(now - LOBBIES_LIVE_STALE_MS).toISOString().replace('T', ' ');
	return `updatedAt > "${since}"`;
}

/** Public live-match list: hide replay playback rows. Overlay still polls by user. */
export function lobbiesLivePublicFilter(now = Date.now()): string {
	return `(${lobbiesLiveFreshFilter(now)}) && isReplay != true`;
}

export function isLiveLobbyFresh(
	lobby: { updatedAt?: string },
	now = Date.now()
): boolean {
	if (!lobby.updatedAt) {
		return false;
	}

	const updatedAt = new Date(lobby.updatedAt).getTime();
	return Number.isFinite(updatedAt) && updatedAt > now - LOBBIES_LIVE_STALE_MS;
}

export function isPublicLiveLobby(
	lobby: { updatedAt?: string; isReplay?: boolean },
	now = Date.now()
): boolean {
	return isLiveLobbyFresh(lobby, now) && !lobby.isReplay;
}

function toRecord(row: CollectionLobby): LiveLobbyRecord | null {
	const record = toLiveLobbyRecord({
		id: row.id,
		lobbyId: row.lobby || null,
		sessionId: row.sessionId,
		map: row.map,
		isRanked: row.isRanked,
		isReplay: row.isReplay,
		matchType: row.matchType,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		hostName: row.expand?.user?.name ?? row.expand?.user?.email ?? '',
		players: row.players
	});
	if (!record || !isLiveLobbyFresh(record)) {
		return null;
	}

	const rawPlayers = (Array.isArray(row.players) ? row.players : []) as LiveLobbyRawPlayer[];
	return {
		...record,
		players: attachLiveLobbyStats(
			record.players,
			rawPlayers,
			record.isRanked,
			record.matchType
		)
	};
}

function uniqueBySession(items: LiveLobbyRecord[]) {
	const seen: Record<string, true> = {};
	const unique: LiveLobbyRecord[] = [];
	for (const item of items) {
		if (seen[item.sessionId]) {
			continue;
		}

		seen[item.sessionId] = true;
		unique.push(item);
	}

	return unique;
}

/** Overlay only needs ratings + match type; drop Relic counters / aliases. */
function slimMatchHistoryForOverlay(history: unknown[] | undefined): unknown[] | undefined {
	if (!history?.length) {
		return history;
	}

	return history.map((match) => {
		const row = match as Record<string, unknown>;
		const players = Array.isArray(row.players) ? row.players : [];
		return {
			matchtype_id: row.matchtype_id,
			completiontime: row.completiontime,
			startgametime: row.startgametime,
			players: players.map((member) => {
				const player = member as Record<string, unknown>;
				return {
					profile_id: player.profile_id,
					newrating: player.newrating,
					oldrating: player.oldrating,
					race_id: player.race_id
				};
			})
		};
	});
}

export class LiveLobbiesApi {
	constructor(private deps: ApiDeps) {}

	getOne(id: string): ResultAsync<LiveLobbyRow, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobbies_live')
				.getOne<LiveLobbyRow>(id, pbOptions(this.deps, { expand: 'user' })),
			'Failed to load live lobby.'
		).orElse((error) => {
			if (error.status === 404) {
				return errAsync(apiError(404, 'This match is no longer live.'));
			}

			return errAsync(error);
		});
	}

	get(id: string): ResultAsync<LiveLobbyRecord, ApiError> {
		return this.getOne(id).andThen((row) => {
			const lobby = toRecord(row);
			if (!lobby) {
				return errAsync(apiError(404, 'This match is no longer live.'));
			}

			return ok(lobby);
		});
	}

	list(): ResultAsync<LiveLobbyRecord[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies_live').getList<CollectionLobby>(1, LIST_LIMIT, pbOptions(this.deps, {
				filter: lobbiesLivePublicFilter(),
				sort: '-updatedAt',
				expand: 'user'
			})),
			'Failed to load live lobbies.'
		).map((response) => {
			const items: LiveLobbyRecord[] = [];
			for (const row of response.items) {
				const lobby = toRecord(row);
				if (lobby) {
					items.push(lobby);
				}
			}

			return uniqueBySession(items);
		});
	}

	getList(page = 1, perPage = 20): ResultAsync<ListResult<LiveLobbyRow>, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies_live').getList<LiveLobbyRow>(page, perPage, pbOptions(this.deps, {
				filter: lobbiesLivePublicFilter(),
				sort: '-updatedAt',
				expand: 'user'
			})),
			'Failed to load live lobbies.'
		);
	}

	/** True when a fresh public live row still points at this saved match / session. */
	isActiveForMatch(matchId: string, sessionId: number): ResultAsync<boolean, ApiError> {
		if (!matchId || !sessionId) {
			return okAsync(false);
		}

		const filter = `(${lobbiesLivePublicFilter()}) && (lobby="${matchId}" || sessionId=${sessionId})`;
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies_live').getList(1, 1, pbOptions(this.deps, {
				filter,
				fields: 'id'
			})),
			'Failed to check live lobby.'
		).map((response) => response.items.length > 0);
	}

	subscribe(
		topic: string,
		callback: (event: RecordSubscription<LiveLobbyRow>) => void
	): ResultAsync<UnsubscribeFunc, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies_live').subscribe<LiveLobbyRow>(
				topic,
				callback,
				pbOptions(this.deps, { expand: 'user' })
			),
			'Failed to subscribe to live lobbies.'
		);
	}

	setLobby(data: LiveLobbyWriteInput): ResultAsync<LiveLobbyRow | undefined, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return okAsync(undefined);
		}

		if (!data.sessionId || !data.map || data.players.length === 0) {
			return okAsync(undefined);
		}

		return fromPbPromise(this.upsertLobby(auth.value, data), 'Failed to update live lobby.');
	}

	removeLobby(): ResultAsync<void, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return okAsync(undefined);
		}

		return fromPbPromise(this.deleteLobby(auth.value), 'Failed to remove live lobby.');
	}

	private async upsertLobby(userId: string, data: LiveLobbyWriteInput): Promise<LiveLobbyRow | undefined> {
		// App may still hold replay placeholders (playerId 0) that pass a looser
		// local roster check; required JSON `players` rejects [] as blank.
		const occupied = data.players.filter(isOccupiedLobbySlot) as LiveLobbyWritePlayer[];
		if (occupied.length === 0) {
			return undefined;
		}

		const players = data.isReplay ? occupied : await this.withOverlayEloSources(occupied);
		const payload: Record<string, unknown> = {
			user: userId,
			isRanked: data.isRanked,
			isReplay: data.isReplay ?? false,
			sessionId: data.sessionId,
			map: data.map,
			players
		};
		if (data.matchType != null) {
			payload.matchType = data.matchType;
		}
		if (data.lobby) {
			payload.lobby = data.lobby;
		}

		try {
			const existing = await this.deps.pocketbase
				.collection('lobbies_live')
				.getFirstListItem(`user="${userId}"`, pbOptions(this.deps));
			return (await this.deps.pocketbase
				.collection('lobbies_live')
				.update(existing.id, payload, pbOptions(this.deps))) as LiveLobbyRow;
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return (await this.deps.pocketbase
					.collection('lobbies_live')
					.create(payload, pbOptions(this.deps))) as LiveLobbyRow;
			}

			throw error;
		}
	}

	private async deleteLobby(userId: string): Promise<void> {
		try {
			const existing = await this.deps.pocketbase
				.collection('lobbies_live')
				.getFirstListItem(`user="${userId}"`, pbOptions(this.deps));
			await this.deps.pocketbase.collection('lobbies_live').delete(existing.id, pbOptions(this.deps));
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return;
			}

			throw error;
		}
	}

	private async withOverlayEloSources(players: LiveLobbyWritePlayer[]): Promise<LiveLobbyWritePlayer[]> {
		const steamIds = players
			.map((player) => player.steamId)
			.filter((steamId): steamId is string => Boolean(steamId));
		const ratings = new Map<string, unknown>();
		if (steamIds.length > 0) {
			const BATCH_SIZE = 40;
			for (let i = 0; i < steamIds.length; i += BATCH_SIZE) {
				const batch = steamIds.slice(i, i + BATCH_SIZE);
				try {
					const filter = batch.map((id) => `steamId="${id}"`).join('||');
					const rows = await this.deps.pocketbase.collection('player_ratings').getFullList(
						pbOptions(this.deps, { filter, fields: 'steamId,elo' })
					);
					for (const row of rows) {
						const steamId = String(row.steamId ?? '');
						if (steamId) {
							ratings.set(steamId, row.elo);
						}
					}
				} catch {
					// Soft-fail ratings enrichment.
				}
			}
		}

		return players.map((player) => {
			const storedElo =
				player.storedElo ?? (player.steamId ? ratings.get(player.steamId) : undefined);
			return {
				...player,
				storedElo,
				matchHistory: slimMatchHistoryForOverlay(player.matchHistory)
			};
		});
	}
}
