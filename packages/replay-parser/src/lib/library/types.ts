export type FactionKey = 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite';

export type SummaryPlayer = {
	slot: number;
	name: string;
	faction: string;
	/** 0 / 1 when the replay knows the side, otherwise derived from the faction. */
	team: number;
	doctrine?: number;
	doctrineName?: string;
};

/** What the list needs from a `.rec`; cached per file size + modified time. */
export type ReplaySummary = {
	replayName: string;
	mapFileName: string;
	mapName: string;
	gameDate: string;
	matchType: string;
	highResources: boolean;
	randomStart: boolean;
	vpGame: boolean;
	vpCount: number;
	durationSeconds: number;
	players: SummaryPlayer[];
	headerOk: boolean;
};

export type ReplayEntry = {
	fileName: string;
	path: string;
	size: number;
	/** Unix ms of the last write. */
	modified: number;
	summary: ReplaySummary | null;
	error?: string;
};
