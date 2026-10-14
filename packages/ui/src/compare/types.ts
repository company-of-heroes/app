import type { CompareAccount, CompareData } from '@company-of-heroes/api/compare';
import type { HeadToHead } from '@company-of-heroes/api/head-to-head';
import type { PlayerPerformance } from '@company-of-heroes/api/player-performance';

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

/** The comparison for the selected accounts, combined into one "me". */
export type CompareView = {
	accounts: CompareAccount[];
	isSelf: boolean;
	me: {
		performance: PlayerPerformance;
		/** Best rank per leaderboard. */
		best: CompareBestRank[];
		/** Highest rating per mode + faction. */
		elo: CompareBestElo[];
	};
	them: CompareData['them'];
	headToHead: HeadToHead;
};
