import type { PlayerLabel } from '$lib/utils/player/labels';

export type { PlayerLabel } from '$lib/utils/player/labels';

export type LeaderboardStat = {
	leaderboard_id: number;
	wins: number;
	losses: number;
	streak: number;
	rank: number;
	ranklevel: number;
};

export type PlayerEloSlot = {
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerEloMap = Record<string, Record<string, PlayerEloSlot>>;

export type PerformanceRecentMatch = {
	id: string;
	sessionId: number;
	outcome: 0 | 1;
	raceId: number | null;
	matchtypeId: number | null;
};

export type PlayerPerformance = {
	matchCount: number;
	wins: number;
	losses: number;
	recentMatches: PerformanceRecentMatch[];
	byMap: Array<{ map: string; wins: number; losses: number }>;
	byFaction: Array<{ raceId: number; wins: number; losses: number }>;
	byMode: Array<{ matchtypeId: number; wins: number; losses: number }>;
};

export type MatchHistoryPlayer = {
	profile_id: number;
	alias: string;
	steamId: string;
	teamid: number;
	race_id: number;
	wins: number;
	losses: number;
	streak: number;
	outcome: number;
	oldrating: number;
	newrating: number;
	country?: string;
	avatarUrl?: string | null;
	labels?: PlayerLabel[];
	likeCount?: number;
};

export type TransformedMatch = {
	id: number;
	mapname: string;
	matchtype_id: number;
	startgametime: number;
	completiontime: number;
	players: MatchHistoryPlayer[];
	outcome: number;
	lobbyId?: string | null;
};

export type PlayerSmurf = {
	lenderSteamId: string;
	lenderProfileId: number | null;
	lenderAlias: string;
	lenderAvatarUrl: string | null;
};

export type PlayerPageData = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	personastate: number;
	gameextrainfo: string | null;
	lastlogoff: number | null;
	timecreated?: number | null;
	playtimeForever: number | null;
	playtime2weeks: number | null;
	leaderboardStats: LeaderboardStat[];
	elo: PlayerEloMap;
	performance: PlayerPerformance;
	matchHistory: TransformedMatch[];
	smurf?: PlayerSmurf | null;
	labels?: PlayerLabel[];
	likeCount?: number;
};
