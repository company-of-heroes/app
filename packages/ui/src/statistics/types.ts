export const STATISTICS_MODES = ['1v1', '2v2', '3v3', '4v4', 'basic', 'skirmish'] as const;
export type StatisticsMode = (typeof STATISTICS_MODES)[number];

/** English tab label per mode (hosts translate it). */
export const STATISTICS_MODE_LABELS: Record<StatisticsMode, string> = {
	'1v1': '1v1',
	'2v2': '2v2',
	'3v3': '3v3',
	'4v4': '4v4',
	basic: 'Basic Match',
	skirmish: 'Skirmish'
};

export const STATISTICS_PERIODS = ['all', '365', '90', '30', '7'] as const;
export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number];

/** A preset period, or a custom range of UTC days (YYYY-MM-DD, both inclusive). */
export type StatisticsRange = { period: StatisticsPeriod } | { from: string; to: string };

export type StatisticsMap = {
	map: string;
	played: number;
	avgDurationSeconds: number | null;
	/** Matches where the winning side is known. */
	decided: number;
	alliesWins: number;
};

export type StatisticsFaction = {
	raceId: number;
	/** Player-games, uploaded replays included. */
	picks: number;
	/** Wins and losses come from matches with a result only. */
	wins: number;
	losses: number;
};

/** One Allies faction against one Axis faction (a team game counts once per pair present). */
export type StatisticsMatchup = {
	alliesRaceId: number;
	axisRaceId: number;
	games: number;
	alliesWins: number;
};

export type StatisticsFacts = {
	longestMatch: { lobbyId: string; map: string; durationSeconds: number } | null;
	mostActive: { profileId: number; alias: string; games: number } | null;
	/** UTC hour (0-23) in which most matches started. */
	busiestHour: number | null;
	topDoctrine: StatisticsDoctrine | null;
	topUnit: StatisticsBlueprint | null;
};

/** A doctrine as picked by one faction in replays. */
export type StatisticsDoctrine = {
	raceId: number;
	doctrine: number;
	name: string;
	picks: number;
	/** Picks where the winning side is known. */
	decided: number;
	wins: number;
};

/** A squad or upgrade one faction ordered in replays. */
export type StatisticsBlueprint = {
	raceId: number;
	id: number;
	name: string;
	/** Orders in total. */
	count: number;
	/** Player-games that ordered it at least once. */
	players: number;
};

/** Replay coverage per faction: player-games with a replay summary. */
export type StatisticsReplayPlayers = { raceId: number; players: number };

export type CommunityStatistics = {
	matchCount: number;
	firstAt: string | null;
	lastAt: string | null;
	maps: StatisticsMap[];
	factions: StatisticsFaction[];
	matchups: StatisticsMatchup[];
	facts: StatisticsFacts;
	/** Matches with a summarized replay (the source of everything below). */
	replayMatches: number;
	/** Uploaded replays among `matchCount`: no result, so not in any win rate. */
	uploadMatches: number;
	replayPlayers: StatisticsReplayPlayers[];
	doctrines: StatisticsDoctrine[];
	units: StatisticsBlueprint[];
	upgrades: StatisticsBlueprint[];
	/** First non-builder squad; `count` = player-games that opened with it. */
	openings: StatisticsBlueprint[];
};

export type StatisticsByMode = Record<StatisticsMode, CommunityStatistics>;

/** What one human player of a replay picked and built (stored on `lobbies.replayStats`). */
export type ReplaySummaryPlayer = {
	race: number;
	doctrine: number | null;
	/** Squad blueprint id → orders that were not cancelled. */
	units: Record<string, number>;
	/** Upgrade blueprint id → purchases that were not cancelled. */
	upgrades: Record<string, number>;
	/** First squad ordered that is not a builder (Engineers, Sappers, Pioneers). */
	opening: number | null;
};

export type ReplaySummary = {
	v: number;
	/** A computer player took part (a skirmish). Missing on version 1 summaries. */
	ai?: boolean;
	players: ReplaySummaryPlayer[];
};

export type StatisticsHeadline = {
	/** Finished community matches stored (all modes). */
	totalMatches: number;
	matchesToday: number;
	liveNow: number;
	replaysUploaded: number;
};
