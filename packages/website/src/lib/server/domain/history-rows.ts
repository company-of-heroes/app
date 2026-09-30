import { leaderboardIdForMatchRace } from './relic-matches';

/**
 * Shapes lobby records into match-history list rows (same JSON as the legacy
 * PocketBase route). Pure functions; the service does the reads.
 */

export type ListPlayerStats = {
	elo: number | null;
	wins: number;
	losses: number;
	streak: number;
	rank: number;
	rankLevel: number;
};

export type ListPlayer = {
	playerId: number | null;
	steamId: string | null;
	race: number | null;
	profile: { profile_id: number; alias: string };
	stats?: ListPlayerStats | null;
	likeCount?: number;
};

export type HistoryRow = {
	id: string;
	map: string;
	title: string;
	result: {
		matchtype_id?: number;
		players: { profile_id: number; outcome?: number; oldrating?: number; newrating?: number }[];
	} | null;
	createdAt: string;
	isRanked: boolean;
	sessionId: number;
	needsResult: boolean;
	hasReplay: boolean;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	durationSeconds: number | null;
	players: ListPlayer[];
};

/** The `lobbies` fields a list row needs. */
export const HISTORY_ROW_FIELDS =
	'id,map,title,result,createdAt,isRanked,sessionId,needsResult,hasReplay,likeCount,downloadCount,commentCount,durationSeconds,lobbyPlayers';

export type LobbyListRecord = {
	id: string;
	map: string;
	title: string;
	result: ResultJson | null;
	createdAt: string;
	isRanked: boolean;
	sessionId: number;
	needsResult: boolean;
	hasReplay: boolean;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	durationSeconds: number;
	lobbyPlayers: LobbyPlayerSummary[] | null;
};

/** Relic match result JSON; numbers when present. */
type ResultPlayer = {
	profile_id: number;
	outcome?: number;
	oldrating?: number;
	newrating?: number;
	race_id?: number;
	steamId?: string;
	name?: string;
	alias?: string;
};
type ResultJson = {
	matchtype_id?: number;
	players?: ResultPlayer[];
	startgametime?: number;
	completiontime?: number;
};

type LobbyPlayerSummary = {
	profile_id?: unknown;
	profile?: { profile_id?: unknown; alias?: string };
	playerId?: unknown;
	steamId?: string | null;
	race?: unknown;
	alias?: string;
	stats?: unknown;
};

/** Raw `lobbies.players` entry (Relic profile snapshot at match time). */
export type RawLobbyPlayer = {
	playerId?: unknown;
	steamId?: string;
	race?: unknown;
	profile?: { profile_id?: unknown; leaderboardStats?: Record<string, unknown>[] };
};

export type RawLobby = {
	id: string;
	players: RawLobbyPlayer[] | null;
	result: ResultJson | null;
	isRanked: boolean;
};

function finite(value: unknown): number | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export function normalizeStats(raw: unknown): ListPlayerStats | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}

	const stats = raw as Record<string, unknown>;
	const elo = finite(stats.elo);
	const wins = finite(stats.wins) ?? 0;
	const losses = finite(stats.losses) ?? 0;
	const streak = finite(stats.streak) ?? 0;
	const rank = finite(stats.rank) ?? 0;
	const rankLevel = finite(stats.rankLevel ?? stats.ranklevel) ?? 0;
	const resolvedElo = elo !== null && elo >= 1 ? elo : null;
	if (resolvedElo === null && wins === 0 && losses === 0 && rank === 0 && rankLevel === 0) {
		return null;
	}

	return {
		elo: resolvedElo,
		wins,
		losses,
		streak,
		rank: Math.max(rank, 0),
		rankLevel: Math.max(rankLevel, 0)
	};
}

function playersFromSummaries(summaries: LobbyPlayerSummary[]): ListPlayer[] {
	const players: ListPlayer[] = [];
	for (const player of summaries) {
		const profileId = finite(player.profile_id) ?? finite(player.profile?.profile_id);
		if (profileId === null) {
			continue;
		}

		const entry: ListPlayer = {
			playerId: finite(player.playerId),
			steamId: player.steamId ?? null,
			race: finite(player.race),
			profile: { profile_id: profileId, alias: player.alias ?? player.profile?.alias ?? '' }
		};
		const stats = normalizeStats(player.stats);
		if (stats) {
			entry.stats = stats;
		}

		players.push(entry);
	}
	return players;
}

function playersFromResult(result: ResultJson | null): ListPlayer[] {
	const players: ListPlayer[] = [];
	for (const player of result?.players ?? []) {
		const profileId = finite(player.profile_id);
		if (profileId === null) {
			continue;
		}

		const steamId =
			player.steamId ??
			(player.name?.startsWith('/steam/') ? player.name.slice('/steam/'.length) : null);
		players.push({
			playerId: profileId,
			steamId,
			race: finite(player.race_id),
			profile: { profile_id: profileId, alias: player.alias ?? '' }
		});
	}
	return players;
}

/** Summaries written at ingest; the result's player list for the few lobbies without them. */
function resolvePlayers(record: LobbyListRecord): ListPlayer[] {
	const fromSummaries = playersFromSummaries(record.lobbyPlayers ?? []);
	if (fromSummaries.some((player) => player.race !== null)) {
		return fromSummaries;
	}

	const fromResult = playersFromResult(record.result);
	return fromResult.length > 0 ? fromResult : fromSummaries;
}

function durationFrom(record: LobbyListRecord): number | null {
	if (record.durationSeconds > 0) {
		return record.durationSeconds;
	}

	const start = finite(record.result?.startgametime);
	const end = finite(record.result?.completiontime);
	return start !== null && end !== null && end > start ? end - start : null;
}

export function toHistoryRow(record: LobbyListRecord): HistoryRow {
	const result = record.result;
	return {
		id: record.id,
		map: record.map,
		title: record.title,
		// Slim result for list rows: outcomes (team tint) + ratings/matchtype (Pro badge).
		result: Array.isArray(result?.players)
			? {
					matchtype_id: result.matchtype_id,
					players: result.players.map((player) => ({
						profile_id: player.profile_id,
						outcome: player.outcome,
						oldrating: player.oldrating,
						newrating: player.newrating
					}))
				}
			: null,
		createdAt: record.createdAt,
		isRanked: record.isRanked,
		sessionId: record.sessionId,
		needsResult: record.needsResult,
		hasReplay: record.hasReplay,
		likeCount: record.likeCount || 0,
		downloadCount: record.downloadCount || 0,
		commentCount: record.commentCount || 0,
		durationSeconds: durationFrom(record),
		players: resolvePlayers(record)
	};
}

// ---- rank / ELO badges -------------------------------------------------------

/**
 * Ladder for rank badges: Relic ranked 1-4 / skirmish 14 from the result, else inferred
 * from the human count. Unranked (Basic Match) uses the basic ladders (0) and gets no ranks.
 */
function ladderMatchType(
	result: ResultJson | null,
	players: { playerId?: unknown; profile_id?: unknown }[],
	isRanked: boolean
): number {
	const fromResult = finite(result?.matchtype_id);
	if (fromResult === 14) {
		return 14;
	}

	if (!isRanked) {
		return 0;
	}

	if (fromResult !== null && fromResult >= 1 && fromResult <= 4) {
		return fromResult;
	}

	const humans = players.filter(
		(player) => finite(player.playerId ?? player.profile_id) !== -1
	).length;
	return ({ 2: 1, 4: 2, 6: 3, 8: 4 } as Record<number, number>)[humans] ?? 0;
}

function eloByProfile(result: ResultJson | null): Map<number, number> {
	const elo = new Map<number, number>();
	for (const player of result?.players ?? []) {
		const profileId = finite(player.profile_id);
		if (profileId === null || profileId <= 0) {
			continue;
		}

		const before = finite(player.oldrating);
		const after = finite(player.newrating);
		const rating =
			before !== null && before >= 1 ? before : after !== null && after >= 1 ? after : null;
		if (rating !== null) {
			elo.set(profileId, rating);
		}
	}
	return elo;
}

function rawProfileId(raw: RawLobbyPlayer): number | null {
	const fromProfile = finite(raw.profile?.profile_id);
	if (fromProfile !== null) {
		return fromProfile;
	}

	const playerId = finite(raw.playerId);
	return playerId !== null && playerId > 0 ? playerId : null;
}

function statsFromRaw(
	raw: RawLobbyPlayer | undefined,
	matchTypeId: number,
	elo: Map<number, number>
): ListPlayerStats | null {
	if (!raw) {
		return null;
	}

	const race = finite(raw.race);
	if (race === null) {
		return null;
	}

	const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
	const stat =
		leaderboardId === null
			? undefined
			: (raw.profile?.leaderboardStats ?? []).find(
					(entry) => finite(entry.leaderboard_id) === leaderboardId
				);
	const profileId = rawProfileId(raw);
	return normalizeStats({
		elo: profileId !== null ? (elo.get(profileId) ?? null) : null,
		wins: stat?.wins ?? 0,
		losses: stat?.losses ?? 0,
		streak: stat?.streak ?? 0,
		rank: stat?.rank ?? 0,
		rankLevel: stat?.ranklevel ?? stat?.rankLevel ?? 0
	});
}

/** Rows whose players lack stats written at ingest; their raw players must be loaded. */
export function rowsNeedingRawPlayers(rows: HistoryRow[]): string[] {
	return rows
		.filter((row) =>
			row.players.some((player) => {
				const stats = normalizeStats(player.stats);
				return row.isRanked ? !stats || (stats.rank <= 0 && stats.rankLevel <= 0) : !stats;
			})
		)
		.map((row) => row.id);
}

/** Fills each player's rank/level/ELO badge from ingest summaries or the raw lobby players. */
export function attachPlayerStats(rows: HistoryRow[], rawById: Map<string, RawLobby>): void {
	for (const row of rows) {
		const raw = rawById.get(row.id);
		const rawPlayers = raw?.players ?? [];
		const result = raw ? raw.result : (row.result as ResultJson | null);
		const isRanked = raw ? raw.isRanked : row.isRanked;
		const matchTypeId = ladderMatchType(
			result,
			rawPlayers.length > 0
				? rawPlayers
				: row.players.map((player) => ({
						playerId: player.playerId,
						profile_id: player.profile.profile_id
					})),
			isRanked
		);
		const elo = eloByProfile(result);

		for (const player of row.players) {
			const existing = normalizeStats(player.stats);
			if (isRanked && existing && (existing.rank > 0 || existing.rankLevel > 0)) {
				player.stats = existing;
			} else {
				const match = rawPlayers.find(
					(candidate) =>
						rawProfileId(candidate) === player.profile.profile_id ||
						(!!player.steamId &&
							!!candidate.steamId &&
							String(candidate.steamId) === player.steamId)
				);
				player.stats = statsFromRaw(match, matchTypeId, elo) ?? existing ?? null;
			}

			// Summaries written before the result arrived have no ELO; the result's rating does.
			const rating = elo.get(player.profile.profile_id);
			if (player.stats && player.stats.elo === null && rating !== undefined) {
				player.stats = { ...player.stats, elo: rating };
			}
		}
	}
}
