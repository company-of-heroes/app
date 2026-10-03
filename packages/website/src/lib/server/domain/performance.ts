import { isRankedMatchType } from '@company-of-heroes/ui/format/match-type';

/** Win/loss summary of one player's (or the signed-in user's) finished games. */

export type WinLoss = { wins: number; losses: number };
export type PlayerPerformance = {
	matchCount: number;
	wins: number;
	losses: number;
	recentMatches: {
		id: string;
		sessionId: number;
		outcome: 0 | 1;
		raceId: number | null;
		matchtypeId: number | null;
	}[];
	byMap: (WinLoss & { map: string })[];
	byFaction: (WinLoss & { raceId: number })[];
	byMode: (WinLoss & { matchtypeId: number })[];
};

/** One `lobby_player_index` row of the player. */
export type PerformanceRow = {
	id: string;
	lobby: string;
	session_id: number;
	map: string;
	outcome: number | null;
	race_id: number | null;
	matchtype_id: number | null;
};

const MAP_LIMIT = 8;
const FORM_LIMIT = 10;

export function emptyPerformance(): PlayerPerformance {
	return {
		matchCount: 0,
		wins: 0,
		losses: 0,
		recentMatches: [],
		byMap: [],
		byFaction: [],
		byMode: []
	};
}

const byGames = (a: WinLoss, b: WinLoss) => b.wins + b.losses - (a.wins + a.losses);
const isRankedMode = (matchtypeId: number) => matchtypeId >= 1 && matchtypeId <= 4;

/**
 * Aggregates index rows into totals, per map (top 8), per faction and per mode, plus
 * the last 10 results. Totals, maps, factions and form are ranked games only (Basic
 * Matches against friends would skew them); the per-mode table keeps every mode. A
 * session counts once, even when the user played it on two linked accounts (first
 * row by id wins, as before).
 */
export function summarizePerformance(rows: PerformanceRow[]): PlayerPerformance {
	const decided = rows.filter(
		(row) => row.session_id > 0 && (row.outcome === 0 || row.outcome === 1)
	);
	const perSession = new Map<number, PerformanceRow>();
	for (const row of [...decided].sort((a, b) => a.id.localeCompare(b.id))) {
		if (!perSession.has(row.session_id)) {
			perSession.set(row.session_id, row);
		}
	}
	const games = [...perSession.values()];
	const ranked = games.filter(
		(row) => row.matchtype_id !== null && isRankedMatchType(row.matchtype_id)
	);

	const tally = <K>(rows: PerformanceRow[], key: (row: PerformanceRow) => K | null) => {
		const counts = new Map<K, WinLoss>();
		for (const row of rows) {
			const k = key(row);
			if (k === null) {
				continue;
			}

			const entry = counts.get(k) ?? { wins: 0, losses: 0 };
			if (row.outcome === 1) {
				entry.wins++;
			} else {
				entry.losses++;
			}

			counts.set(k, entry);
		}
		return [...counts];
	};

	const wins = ranked.filter((row) => row.outcome === 1).length;
	const losses = ranked.length - wins;

	return {
		matchCount: wins + losses,
		wins,
		losses,
		recentMatches: ranked
			.sort((a, b) => b.session_id - a.session_id)
			.slice(0, FORM_LIMIT)
			.map((row) => ({
				id: row.lobby,
				sessionId: row.session_id,
				outcome: row.outcome === 1 ? 1 : 0,
				raceId: row.race_id,
				matchtypeId: row.matchtype_id
			})),
		byMap: tally(ranked, (row) => row.map || 'Unknown')
			.map(([map, count]) => ({ map, ...count }))
			.sort(byGames)
			.slice(0, MAP_LIMIT),
		byFaction: tally(ranked, (row) =>
			row.race_id !== null && row.race_id >= 0 && row.race_id <= 3 ? row.race_id : null
		)
			.map(([raceId, count]) => ({ raceId, ...count }))
			.sort(byGames),
		byMode: tally(games, (row) => row.matchtype_id)
			.map(([matchtypeId, count]) => ({ matchtypeId, ...count }))
			.sort((a, b) =>
				isRankedMode(a.matchtypeId) !== isRankedMode(b.matchtypeId)
					? isRankedMode(a.matchtypeId)
						? -1
						: 1
					: a.matchtypeId - b.matchtypeId
			)
	};
}
