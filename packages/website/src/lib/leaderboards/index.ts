import type { PlayerEloMap, PlayerLabel } from '$lib/player';

export type RelicLeaderboardProfile = {
	profile_id: number;
	alias: string;
	country: string | null;
	name: string;
	avatarUrl?: string;
	labels?: PlayerLabel[];
};

export type LeaderboardStatWithProfile = {
	leaderboard_id: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	profile: RelicLeaderboardProfile;
};

export type LeaderboardPageData = {
	leaderboardId: number;
	stats: LeaderboardStatWithProfile[];
	eloBySteamId: Record<string, PlayerEloMap>;
};

export type LeaderboardFaction = {
	label: string;
	value: number;
	race: number;
};

export type LeaderboardMode = {
	label: string;
	value: number;
	factions: LeaderboardFaction[];
};

export const DEFAULT_BOARD_ID = 4;

export const LEADERBOARD_MODES: LeaderboardMode[] = [
	{
		label: '1v1',
		value: 4,
		factions: [
			{ label: 'US Forces', value: 4, race: 0 },
			{ label: 'British Forces', value: 6, race: 2 },
			{ label: 'Wehrmacht', value: 5, race: 1 },
			{ label: 'Panzer Elite', value: 7, race: 3 }
		]
	},
	{
		label: '2v2',
		value: 8,
		factions: [
			{ label: 'US Forces', value: 8, race: 0 },
			{ label: 'British Forces', value: 10, race: 2 },
			{ label: 'Wehrmacht', value: 9, race: 1 },
			{ label: 'Panzer Elite', value: 11, race: 3 }
		]
	},
	{
		label: '3v3',
		value: 12,
		factions: [
			{ label: 'US Forces', value: 12, race: 0 },
			{ label: 'British Forces', value: 14, race: 2 },
			{ label: 'Wehrmacht', value: 13, race: 1 },
			{ label: 'Panzer Elite', value: 15, race: 3 }
		]
	},
	{
		label: '4v4',
		value: 16,
		factions: [
			{ label: 'US Forces', value: 16, race: 0 },
			{ label: 'British Forces', value: 18, race: 2 },
			{ label: 'Wehrmacht', value: 17, race: 1 },
			{ label: 'Panzer Elite', value: 19, race: 3 }
		]
	}
];

export function parseBoardId(value: string | null | undefined): number {
	const id = Number(value);
	if (Number.isInteger(id) && id >= 4 && id <= 19) {
		return id;
	}
	return DEFAULT_BOARD_ID;
}

export function getModeForBoard(boardId: number): LeaderboardMode {
	return (
		LEADERBOARD_MODES.find((mode) => mode.factions.some((faction) => faction.value === boardId)) ??
		LEADERBOARD_MODES[0]
	);
}

export function boardIdForMode(mode: LeaderboardMode, currentBoardId: number): number {
	if (mode.factions.some((faction) => faction.value === currentBoardId)) {
		return currentBoardId;
	}
	return mode.factions[0].value;
}
