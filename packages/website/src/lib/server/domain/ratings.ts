/**
 * Stored ELO per player (`player_ratings.elo`): match type -> race -> latest rating.
 * Keys are strings ("1".."7" match types, "0".."3" races); older rows stored arrays.
 */
export type EloSlot = { rating: number; matchId: number; at: number };
export type EloMap = Record<string, Record<string, EloSlot>>;

const STEAM_ID = /^7656119\d{10}$/;

export function isValidSteamId(value: unknown): value is string {
	return typeof value === 'string' && STEAM_ID.test(value);
}

/** Relic names Steam players "/steam/<id>". */
export function steamIdFromRelicName(name: unknown): string {
	return typeof name === 'string' ? name.replace('/steam/', '') : '';
}

function keyed(value: unknown): Record<string, unknown> {
	if (Array.isArray(value)) {
		return Object.fromEntries(
			value.flatMap((item, i) => (item == null ? [] : [[String(i), item]]))
		);
	}

	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Normalizes a stored `elo` value, keeping the newest valid rating per slot. */
export function toEloMap(raw: unknown): EloMap {
	let parsed = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return {};
		}
	}

	const map: EloMap = {};
	for (const [matchKey, races] of Object.entries(keyed(parsed))) {
		const group: Record<string, EloSlot> = {};
		for (const [raceKey, slot] of Object.entries(keyed(races))) {
			if (!slot || typeof slot !== 'object') {
				continue;
			}

			const value = slot as Record<string, unknown>;
			const rating = Number(value.rating);
			if (!Number.isFinite(rating) || rating < 1) {
				continue;
			}

			const at = Number(value.at);
			const current = group[raceKey];
			if (!current || at > Number(current.at || 0)) {
				group[raceKey] = { rating, matchId: Number(value.matchId ?? value.match_id), at };
			}
		}
		if (Object.keys(group).length > 0) {
			map[matchKey] = group;
		}
	}
	return map;
}

/** Relic ranked ladders: 4-7 1v1, 8-11 2v2, 12-15 3v3, 16-19 4v4 (race = id % 4). */
export function isRankedLeaderboard(id: number): boolean {
	return Number.isInteger(id) && id >= 4 && id <= 19;
}

/** Relic sometimes sends arrays as objects keyed "0", "1", ... (or as JSON strings). */
export function asList<T>(raw: unknown): T[] {
	if (Array.isArray(raw)) {
		return raw as T[];
	}

	if (typeof raw === 'string') {
		try {
			return asList<T>(JSON.parse(raw));
		} catch {
			return [];
		}
	}

	if (raw && typeof raw === 'object') {
		return Object.keys(raw)
			.filter((key) => String(Number(key)) === key)
			.sort((a, b) => Number(a) - Number(b))
			.map((key) => (raw as Record<string, T>)[key]);
	}

	return [];
}

export type EloHistoryPoint = {
	at: number;
	rating: number;
	matchtypeId: number;
	raceId: number;
	matchId: number;
};

type HistoryResult = {
	id?: number;
	matchtype_id?: number;
	startgametime?: number;
	completiontime?: number;
	players?: unknown;
};
type HistoryResultPlayer = {
	steamId?: string;
	name?: string;
	profile_id?: number;
	race_id?: number;
	oldrating?: number;
	newrating?: number;
};

/**
 * Rating after each game (newrating) per match type + race, for one player, from
 * stored lobby results. Each series starts with the earliest known pre-game rating
 * so the chart does not begin at the first change.
 */
export function eloHistoryPoints(
	results: HistoryResult[],
	profileId: number | null,
	steamId: string | null
): EloHistoryPoint[] {
	const byKey = new Map<string, EloHistoryPoint>();
	const earliestOld = new Map<string, EloHistoryPoint>();

	for (const match of results) {
		const matchtypeId = Number(match.matchtype_id);
		if (!Number.isInteger(matchtypeId) || matchtypeId < 0 || matchtypeId > 7) {
			continue;
		}

		const at = Number(match.completiontime ?? match.startgametime ?? 0);
		const matchId = Number(match.id);
		if (!Number.isFinite(at) || at < 0 || !Number.isFinite(matchId) || matchId <= 0) {
			continue;
		}

		for (const player of asList<HistoryResultPlayer>(match.players)) {
			const playerSteam =
				player?.steamId ||
				(typeof player?.name === 'string' ? player.name.replace('/steam/', '') : '');
			const isPlayer =
				(profileId !== null && Number(player?.profile_id) === profileId) ||
				(steamId !== null && playerSteam === steamId);
			const raceId = Number(player?.race_id);
			const rating = Number(player?.newrating);
			if (
				!isPlayer ||
				!Number.isInteger(raceId) ||
				raceId < 0 ||
				raceId > 3 ||
				!Number.isFinite(rating) ||
				rating < 1
			) {
				continue;
			}

			const point = { at, rating, matchtypeId, raceId, matchId };
			const key = `${matchId}:${raceId}`;
			const existing = byKey.get(key);
			if (!existing || at >= existing.at) {
				byKey.set(key, point);
			}

			const oldrating = Number(player?.oldrating);
			const series = `${matchtypeId}:${raceId}`;
			const current = earliestOld.get(series);
			if (Number.isFinite(oldrating) && oldrating >= 1 && (!current || at <= current.at)) {
				earliestOld.set(series, { at, rating: oldrating, matchtypeId, raceId, matchId });
			}
		}
	}

	const points = [...byKey.values()];
	const series = new Set(points.map((point) => `${point.matchtypeId}:${point.raceId}`));
	for (const [key, seed] of earliestOld) {
		const seeded = points.some(
			(point) =>
				point.matchtypeId === seed.matchtypeId &&
				point.raceId === seed.raceId &&
				point.at <= seed.at &&
				point.rating === seed.rating
		);
		if (series.has(key) && !seeded) {
			points.push({ ...seed, at: Math.max(0, seed.at - 1) });
		}
	}

	return points.sort((a, b) => a.at - b.at || a.matchId - b.matchId || a.raceId - b.raceId);
}

/** One rating observed in a match, for `mergeElo`. */
export type EloSlotUpdate = {
	matchtypeId: number;
	raceId: number;
	rating: number;
	matchId: number;
	at: number;
};

/** Applies rating observations; a slot only moves forward in time. */
export function mergeElo(existing: EloMap, updates: EloSlotUpdate[]): EloMap {
	const next: EloMap = { ...existing };
	for (const update of updates) {
		const matchKey = String(update.matchtypeId);
		const group = { ...next[matchKey] };
		const current = group[String(update.raceId)];
		if (!current || update.at > Number(current.at || 0)) {
			group[String(update.raceId)] = {
				rating: update.rating,
				matchId: update.matchId,
				at: update.at
			};
			next[matchKey] = group;
		}
	}
	return next;
}

/** Stored match types (0 basic … 7); other Relic types have no ladder. */
function isStoredMatchType(id: number): boolean {
	return Number.isInteger(id) && id >= 0 && id <= 7;
}

/**
 * A client-sent rating observation (either our or Relic's field names); null when
 * unusable. Far-future timestamps are capped so no one can lock a slot forever.
 */
export function normalizeSlot(
	raw: Record<string, unknown>,
	now = Math.floor(Date.now() / 1000)
): EloSlotUpdate | null {
	const matchtypeId = Number(raw.matchtypeId ?? raw.matchtype_id);
	const raceId = Number(raw.raceId ?? raw.race_id);
	const rating = Number(raw.rating ?? raw.newrating);
	const matchId = Number(raw.matchId ?? raw.match_id ?? raw.id);
	let at = Number(raw.at ?? raw.completiontime ?? 0);
	if (!isStoredMatchType(matchtypeId) || !Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	if (
		!Number.isFinite(rating) ||
		rating < 1 ||
		!Number.isFinite(matchId) ||
		matchId <= 0 ||
		!Number.isFinite(at) ||
		at < 0
	) {
		return null;
	}

	if (at > now + 60) {
		at = now;
	}

	return { matchtypeId, raceId, rating, matchId, at };
}

/** One update per Steam id (latest alias and profile win; all slots kept for `mergeElo`). */
export function mergeRatingUpdates<
	T extends { steamId: string; profileId: number; alias: string; slots: EloSlotUpdate[] }
>(updates: T[]): T[] {
	const bySteam = new Map<string, T>();
	for (const update of updates) {
		const current = bySteam.get(update.steamId);
		bySteam.set(
			update.steamId,
			current
				? {
						...update,
						alias: update.alias || current.alias,
						slots: [...current.slots, ...update.slots]
					}
				: update
		);
	}
	return [...bySteam.values()];
}

/** Filled rating slots in a stored map (the harvest refreshes players with gaps first). */
export function eloSlotCount(elo: EloMap): number {
	return Object.values(elo).reduce((sum, group) => sum + Object.keys(group).length, 0);
}
