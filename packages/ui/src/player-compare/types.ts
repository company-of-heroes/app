import type { LeaderboardStat, PlayerEloMap, PlayerPerformance } from '../player/types';

export type PlayerCompareSide = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	leaderboardStats: LeaderboardStat[];
	elo: PlayerEloMap;
	performance: PlayerPerformance;
};

export type PlayerCompareH2hRow = {
	played: number;
	winsLeft: number;
	winsRight: number;
};

export type PlayerCompareH2hMode = PlayerCompareH2hRow & { matchtypeId: number };
export type PlayerCompareH2hMap = PlayerCompareH2hRow & { map: string };

export type PlayerCompareH2hRecent = {
	lobbyId: string;
	sessionId: number;
	map: string;
	matchtypeId: number;
	leftOutcome: 0 | 1;
	rightOutcome: 0 | 1;
};

export type PlayerCompareH2h = {
	played: number;
	winsLeft: number;
	winsRight: number;
	together: number;
	byMode: PlayerCompareH2hMode[];
	byMap: PlayerCompareH2hMap[];
	recent: PlayerCompareH2hRecent[];
};

export type PlayerCompareData = {
	left: PlayerCompareSide;
	right: PlayerCompareSide;
	h2h: PlayerCompareH2h;
};

export type PlayerH2hRecord = {
	played: number;
	wins: number;
	losses: number;
};
