import type { LiveLobbyPlayerStats } from '../live-lobby/types';

export type ReplayMessage = {
	playerID: number;
	sender: string;
	recipient: number;
	timestamp: string;
	content: string;
};

export type ReplayPlayer = {
	id: number | null;
	name: string;
	faction: string;
	doctrineName?: string;
	steamId?: string | null;
};

export type ReplayCommand = {
	type?: string;
	name?: string;
	description?: string;
};

export type ReplayAction = {
	tick: number;
	timestamp: string;
	playerID?: number;
	commandID?: number;
	objectID?: number;
	command?: ReplayCommand;
};

export type ReplayData = {
	playerCount: number;
	duration: number;
	players: ReplayPlayer[];
	messages: ReplayMessage[];
	actions: ReplayAction[];
};

export type HistorySortField = 'createdAt' | 'likeCount' | 'downloadCount' | 'commentCount';
export type HistorySortDir = 'asc' | 'desc';

export type HistoryMatchup = '1v1' | '2v2' | '3v3' | '4v4';
export type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte';
export type CompareFilter = { op: FilterOperator; value: number };

export type HistoryPlayerOption = {
	profile_id: number;
	alias: string;
};

export type HistoryMapOption = {
	map: string;
	name: string;
};

export type ReplaysQuery = {
	page: number;
	ranked: boolean;
	pro: boolean;
	matchups: HistoryMatchup[];
	playerIds: string[];
	maps: string[];
	races: string[];
	positions: string[];
	elo: CompareFilter | null;
	duration: CompareFilter | null;
	sort: HistorySortField;
	sortDir: HistorySortDir;
};

export type CommunityPlayer = {
	playerId: number | null;
	steamId: string | null;
	race: number | null;
	likeCount?: number;
	/** Replay faction id (member uploads), e.g. allies_commonwealth. */
	faction?: string;
	/** Doctrine label from the .rec (member uploads). */
	doctrineName?: string;
	/** Ladder stats when available on list/detail responses. */
	stats?: LiveLobbyPlayerStats | null;
	profile: {
		profile_id: number;
		alias: string;
	};
};

export type MatchResultPlayer = {
	profile_id: number;
	alias?: string;
	steamId?: string;
	wins?: number;
	losses?: number;
	streak?: number;
	outcome?: number;
	oldrating?: number;
	newrating?: number;
	country?: string;
	race_id?: number;
};

export type MatchResult = {
	startgametime?: number;
	completiontime?: number;
	players?: MatchResultPlayer[];
} | null;

export type CommunityMatch = {
	id: string;
	map: string;
	result: MatchResult;
	createdAt: string;
	isRanked: boolean;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	players: CommunityPlayer[];
	title?: string;
	kind?: 'match' | 'member';
	durationSeconds?: number | null;
	description?: string;
	visibility?: 'private' | 'member' | 'deleted';
};

export type CommunityMatchDetail = {
	id: string;
	map: string;
	isRanked: boolean;
	createdAt: string;
	durationSeconds: number | null;
	likeCount: number;
	downloadCount: number;
	players: CommunityPlayer[];
	result: MatchResult;
	title?: string;
	kind?: 'match' | 'member';
	description?: string;
};
