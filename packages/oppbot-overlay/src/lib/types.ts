export interface LeaderboardStat {
	disputes: number;
	drops: number;
	highestrank: number;
	highestranklevel: number;
	lastmatchdate?: number;
	leaderboard_id: number;
	losses: number;
	rank: number;
	ranklevel: number;
	ranktotal: number;
	regionrank: number;
	regionranktotal: number;
	statgroup_id: number;
	streak: number;
	wins: number;
}

export interface PlayerProfile {
	alias: string;
	country: string;
	leaderboardStats: LeaderboardStat[];
	leaderboardregion_id: number;
	level: number;
	name: string;
	personal_statgroup_id: number;
	profile_id: number;
	xp: number;
}

export interface MatchHistoryPlayer {
	profile_id: number;
	newrating: number;
	oldrating: number;
	race_id: number;
	steamId?: string;
}

export interface MatchHistoryEntry {
	matchtype_id: number;
	completiontime?: number;
	startgametime?: number;
	players: MatchHistoryPlayer[];
}

export interface Player {
	index: number;
	playerId: number;
	profile: PlayerProfile;
	race: 0 | 1 | 2 | 3;
	ranking: number;
	steamId: string;
	team: number;
	type: number;
	matchHistory?: MatchHistoryEntry[];
}

export interface Team {
	players: Player[];
}

export interface LobbyData {
	didNotify?: boolean;
	isRanked?: boolean;
	isSkirmish?: boolean;
	map?: string;
	mapName?: string;
	matchType: number;
	me?: { playerId: number; index?: number };
	players?: Player[];
	teams?: Team[];
	topic?: string;
	type?: string;
}

export interface LiveLobbyRecord {
	id: string;
	user: string;
	isRanked?: boolean;
	sessionId: number;
	map: string;
	players: Player[];
	expand?: {
		user?: {
			id: string;
			steamIds?: string[];
		};
	};
}

export interface CombatRecord {
	wins: number;
	losses: number;
	winRate: number | null;
	streak: number;
	elo: string;
}
