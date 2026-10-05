import type { PlayerLabel } from '../format/types';
import type { LiveLobbyPlayerStats } from '../live-lobby/types';
import type { PlayerRewards } from '../reward/types';

export type { PlayerLabel };

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
	/** Current Relic ladder level for this match's mode + race (not historical). */
	ranklevel?: number;
	/** Current Relic ladder position on that ladder; 0 when unranked. */
	rank?: number;
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
	description?: string;
};

export type PlayerSmurf = {
	lenderSteamId: string;
	lenderProfileId: number | null;
	lenderAlias: string;
	lenderAvatarUrl: string | null;
};

export type PlayerSteamBans = {
	vacBans: number;
	gameBans: number;
	daysSinceLastBan: number;
};

export type PlayerProfileLinkType = 'twitch' | 'youtube' | 'other';

export type PlayerProfileLink = {
	type: PlayerProfileLinkType;
	url: string;
	label?: string;
};

export type PlayerCustomization = {
	bio: string | null;
	links: PlayerProfileLink[];
	backgroundUrl: string | null;
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
	performance: PlayerPerformance | null;
	matchHistory: TransformedMatch[];
	smurf?: PlayerSmurf | null;
	/** VAC and game bans on the Steam account; null when it has none. */
	steamBans?: PlayerSteamBans | null;
	labels?: PlayerLabel[];
	likeCount?: number;
	customization?: PlayerCustomization | null;
	/** Preloaded rewards; when left out the header fetches them itself. */
	rewards?: PlayerRewards | null;
};

export type PlayerSearchResult = {
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	steamId: string;
	avatarUrl: string;
	likeCount?: number;
	/** Relic wins+losses across leaderboards; present on search results. */
	matchCount?: number;
};

/** Compact fields shown in profile link previews. */
export type PlayerPreviewData = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	likeCount?: number;
	labels?: PlayerLabel[];
};

/** Local match-faction snapshot for square link previews (no profile fetch). */
export type PlayerFactionPreview = {
	alias: string;
	race: number | null;
	modeLabel?: string | null;
	raceLabel?: string | null;
	avatarUrl?: string | null;
	country?: string | null;
	stats?: LiveLobbyPlayerStats | null;
	rankImageSrc?: string | null;
	factionFlagSrc?: string | null;
};
