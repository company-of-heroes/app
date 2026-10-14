import type { EloMap } from './ratings';
import type { PlayerPerformance } from './performance';
import type { HeadToHead } from './head-to-head';
import type { LeaderboardStat } from './relic-matches';

export type CompareAccount = {
	steamId: string;
	name: string | null;
	avatarUrl: string | null;
	profileId: number | null;
	selected: boolean;
};

export type CompareBestRank = {
	leaderboardId: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	/** The account that holds it. */
	steamId: string;
};

export type CompareBestElo = {
	/** EloMap match key: '0'..'4' (see getMatchTypeIdFromLeaderboardId). */
	matchKey: string;
	/** '0'..'3' */
	raceKey: string;
	rating: number;
	steamId: string;
};

export type Compare = {
	/** Every linked account, for the toggles. */
	accounts: CompareAccount[];
	/** True when `them` is one of the user's own accounts; `me` and `headToHead` may then be empty. */
	isSelf: boolean;
	me: {
		/** Combined over the selected accounts. */
		performance: PlayerPerformance;
		/** Best rank per leaderboard. */
		best: CompareBestRank[];
		/** Highest rating per mode + faction. */
		elo: CompareBestElo[];
	};
	them: {
		steamId: string;
		profileId: number;
		alias: string;
		avatarUrl: string | null;
		country: string | null;
		level: number;
		leaderboardStats: LeaderboardStat[];
		elo: EloMap;
		performance: PlayerPerformance;
	};
	/** The selected accounts combined against them. */
	headToHead: HeadToHead;
};

/** Per leaderboard the lowest positive rank across the accounts; ties go to more wins. */
export function bestRanks(
	stats: { steamId: string; leaderboardStats: LeaderboardStat[] }[]
): CompareBestRank[] {
	const best = new Map<number, CompareBestRank>();
	for (const { steamId, leaderboardStats } of stats) {
		for (const stat of leaderboardStats) {
			if (!(stat.rank > 0)) {
				continue;
			}

			const current = best.get(stat.leaderboard_id);
			const beaten =
				!current ||
				stat.rank < current.rank ||
				(stat.rank === current.rank && stat.wins > current.wins);
			if (beaten) {
				best.set(stat.leaderboard_id, {
					leaderboardId: stat.leaderboard_id,
					rank: stat.rank,
					ranklevel: stat.ranklevel,
					wins: stat.wins,
					losses: stat.losses,
					steamId
				});
			}
		}
	}
	return [...best.values()].sort((a, b) => a.leaderboardId - b.leaderboardId);
}

/** Per mode + faction the highest rating across the accounts. */
export function bestElo(maps: { steamId: string; elo: EloMap }[]): CompareBestElo[] {
	const best = new Map<string, CompareBestElo>();
	for (const { steamId, elo } of maps) {
		for (const [matchKey, races] of Object.entries(elo)) {
			for (const [raceKey, slot] of Object.entries(races)) {
				const key = `${matchKey}:${raceKey}`;
				if (slot.rating > (best.get(key)?.rating ?? 0)) {
					best.set(key, { matchKey, raceKey, rating: slot.rating, steamId });
				}
			}
		}
	}
	return [...best.values()].sort(
		(a, b) => Number(a.matchKey) - Number(b.matchKey) || Number(a.raceKey) - Number(b.raceKey)
	);
}
