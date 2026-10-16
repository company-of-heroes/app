/** The ranked Relic ladders (ids 4-19): one per mode and faction. */

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

function factions(first: number): LeaderboardFaction[] {
	return [
		{ label: 'US Forces', value: first, race: 0 },
		{ label: 'Commonwealth', value: first + 2, race: 2 },
		{ label: 'Wehrmacht', value: first + 1, race: 1 },
		{ label: 'Panzer Elite', value: first + 3, race: 3 }
	];
}

export const LEADERBOARD_MODES: LeaderboardMode[] = [
	{ label: '1v1', value: 4, factions: factions(4) },
	{ label: '2v2', value: 8, factions: factions(8) },
	{ label: '3v3', value: 12, factions: factions(12) },
	{ label: '4v4', value: 16, factions: factions(16) }
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

export function getFactionForBoard(boardId: number): LeaderboardFaction {
	const mode = getModeForBoard(boardId);
	return mode.factions.find((faction) => faction.value === boardId) ?? mode.factions[0];
}

/** The same faction on another mode's ladder. */
export function boardIdForMode(mode: LeaderboardMode, currentBoardId: number): number {
	const race = getFactionForBoard(currentBoardId).race;
	return (mode.factions.find((faction) => faction.race === race) ?? mode.factions[0]).value;
}
