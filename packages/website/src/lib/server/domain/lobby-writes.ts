import { z } from 'zod';

/** Relic replays stay well below this; PocketBase's `lobbies.replay` limit is 50 MB. */
export const MAX_REPLAY_BYTES = 50_000_000;
/** Smaller than any real replay header. */
export const MIN_REPLAY_BYTES = 64;
/** A live lobby without a heartbeat for this long is gone (Alt+F4, crash). */
export const LIVE_STALE_MS = 30 * 60 * 1000;

/** Booleans may arrive as "true"/"false" from form posts. */
const bool = z.preprocess(
	(value) => (value === 'true' ? true : value === 'false' ? false : value),
	z.boolean()
);

const players = z.array(z.record(z.string(), z.unknown())).max(16);

/** What the app sends when it starts or saves a match. */
export const lobbyCreateSchema = z.object({
	sessionId: z.coerce.number().int().positive(),
	isRanked: bool.default(false),
	title: z.string().max(200).default(''),
	map: z.string().max(200).default('Unknown'),
	needsResult: bool.default(true),
	players: players.default([])
});
export type LobbyCreate = z.infer<typeof lobbyCreateSchema>;

/**
 * Fields the lobby's owner may change; everything else is derived or protected. The
 * result only ever comes from Relic (`needsResult` is a request, see `LobbiesService.update`).
 */
export const lobbyUpdateSchema = z
	.object({
		isRanked: bool,
		title: z.string().max(200),
		map: z.string().max(200),
		needsResult: bool,
		players
	})
	.partial();
export type LobbyUpdate = z.infer<typeof lobbyUpdateSchema>;

/** PocketBase stores a missing value as '', 0, null, [] or {}; "Unknown" is the map placeholder. */
function isBlank(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}

	if (typeof value === 'string') {
		return value.trim() === '' || value === 'Unknown';
	}

	if (Array.isArray(value)) {
		return value.length === 0;
	}

	return typeof value === 'object' && Object.keys(value).length === 0;
}

/**
 * What `input` adds to a stored lobby: only fields the lobby is still missing, so a
 * second app reporting the same session fills gaps without overwriting anything.
 */
export function missingLobbyFields(
	lobby: Record<string, unknown>,
	input: LobbyUpdate
): LobbyUpdate {
	const patch: LobbyUpdate = {};
	for (const key of ['title', 'map', 'players'] as const) {
		if (isBlank(lobby[key]) && !isBlank(input[key])) {
			Object.assign(patch, { [key]: input[key] });
		}
	}

	return patch;
}

/** What a companion app publishes while its player is in a lobby or game. */
export const livePublishSchema = z.object({
	sessionId: z.coerce.number().int().min(0),
	isRanked: bool.default(false),
	map: z.string().max(200).default(''),
	players: players.default([]),
	matchType: z.coerce.number().int().optional(),
	isReplay: bool.default(false),
	/** Replays only: the match being watched (a live game gets its lobby from the session). */
	lobby: z.string().max(30).optional()
});
export type LivePublish = z.infer<typeof livePublishSchema>;

/**
 * A new replay replaces the stored one when it is longer (both durations known),
 * otherwise when it is larger. A tie keeps the stored file.
 */
export function shouldReplaceReplay(
	upload: { bytes: number; seconds: number },
	stored: { bytes: number; seconds: number }
): boolean {
	if (upload.seconds > 0 && stored.seconds > 0) {
		return upload.seconds > stored.seconds;
	}

	return upload.bytes > stored.bytes;
}

/** "/steam/<id>" names; other names are not Steam accounts. */
const steamName = (value: unknown) => {
	const name = String(value ?? '').trim();
	return name.startsWith('/steam/') ? name.slice(7) : '';
};

/** Steam ids of everyone in the lobby's player list. */
export function lobbySteamIds(rawPlayers: unknown): string[] {
	const list = Array.isArray(rawPlayers) ? rawPlayers : [];
	return list
		.map((player) => {
			const p = (player ?? {}) as {
				steamId?: unknown;
				name?: unknown;
				profile?: { name?: unknown };
			};
			return String(p.steamId ?? '').trim() || steamName(p.name) || steamName(p.profile?.name);
		})
		.filter(Boolean);
}

/** Title of the durable lobby a live lobby creates, e.g. "2 VS. 2". */
export function titleFromLive(
	live: Pick<LivePublish, 'matchType' | 'players' | 'isRanked'>
): string {
	const matchType = live.matchType;
	if (matchType !== undefined && matchType >= 1 && matchType <= 4) {
		return `${matchType} VS. ${matchType}`;
	}

	if (matchType === 14) {
		return 'Skirmish';
	}

	const humans = live.players.filter((player) => Number(player.playerId) > 0).length;
	if (humans >= 2) {
		const side = Math.max(1, Math.floor(humans / 2));
		return `${side} VS. ${side}`;
	}

	return live.isRanked ? 'Basic Match' : 'Custom Game';
}

/** Keeps "<name>.rec" (safe characters only); anything else becomes "replay.rec". */
export function replayFileName(name: string): string {
	const trimmed = name.trim();
	return trimmed.toLowerCase().endsWith('.rec')
		? trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_')
		: 'replay.rec';
}

/** Relic result fill: tries per lobby before it is marked failed (about an hour at one run per minute). */
export const MAX_RESULT_ATTEMPTS = 60;

/**
 * A player of the lobby whose Relic match history should contain the result:
 * the first profile id from the summary csv, the players, or the summaries.
 */
export function resultProfileId(lobby: {
	playerProfileIdsCsv?: string;
	players?: unknown;
	lobbyPlayers?: unknown;
}): number | null {
	for (const part of String(lobby.playerProfileIdsCsv ?? '').split(',')) {
		const id = Number(part);
		if (part && Number.isFinite(id) && id > 0) {
			return Math.trunc(id);
		}
	}
	for (const list of [lobby.players, lobby.lobbyPlayers]) {
		for (const player of Array.isArray(list) ? list : []) {
			const p = (player ?? {}) as {
				profile_id?: unknown;
				profile?: { profile_id?: unknown };
				playerId?: unknown;
			};
			for (const candidate of [p.profile_id, p.profile?.profile_id, p.playerId]) {
				const id = Number(candidate);
				if (Number.isFinite(id) && id > 0) {
					return Math.trunc(id);
				}
			}
		}
	}
	return null;
}
