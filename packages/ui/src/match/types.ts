import type { LiveLobbyPlayer, LiveLobbyPlayerStats } from '../live-lobby/types';

export type MatchListColumnId =
	| 'map'
	| 'name'
	| 'type'
	| 'allies'
	| 'axis'
	| 'host'
	| 'started'
	| 'date'
	| 'duration'
	| 'rating'
	| 'actions'
	| 'expand';

/** Player shape for list rows — same as live lobby players so expand can reuse LiveLobbyPlayers. */
export type MatchListPlayer = LiveLobbyPlayer;

export type { LiveLobbyPlayerStats };

export type MatchListRow = {
	id: string;
	map: string;
	modeLabel?: string;
	hostName?: string;
	createdAt: string;
	players: MatchListPlayer[];
	durationSeconds?: number | null;
	ratingChange?: number | null;
	alliesOutcome?: 'win' | 'loss';
	axisOutcome?: 'win' | 'loss';
	lobbyId?: string | null;
	sessionId?: number | string | null;
	isRanked?: boolean;
};

export const LIVE_MATCH_LIST_COLUMNS: MatchListColumnId[] = [
	'map',
	'name',
	'type',
	'allies',
	'axis',
	'host',
	'started',
	'actions',
	'expand'
];

export const DEFAULT_MATCH_LIST_COLUMNS: MatchListColumnId[] = [
	'map',
	'name',
	'type',
	'allies',
	'axis',
	'duration',
	'actions',
	'expand'
];
