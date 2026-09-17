enum Race {
	US = 0,
	Wehrmacht = 1,
	Commonwealth = 2,
	PanzerElite = 3
}

const LEADERBOARD_RACE_MAP: Record<number, Race> = {
	4: Race.US,
	8: Race.US,
	12: Race.US,
	16: Race.US,
	0: Race.US,
	42: Race.US,
	46: Race.US,
	50: Race.US,
	54: Race.US,
	5: Race.Wehrmacht,
	9: Race.Wehrmacht,
	13: Race.Wehrmacht,
	17: Race.Wehrmacht,
	1: Race.Wehrmacht,
	43: Race.Wehrmacht,
	47: Race.Wehrmacht,
	51: Race.Wehrmacht,
	55: Race.Wehrmacht,
	6: Race.Commonwealth,
	10: Race.Commonwealth,
	14: Race.Commonwealth,
	18: Race.Commonwealth,
	2: Race.Commonwealth,
	44: Race.Commonwealth,
	7: Race.PanzerElite,
	11: Race.PanzerElite,
	15: Race.PanzerElite,
	19: Race.PanzerElite,
	3: Race.PanzerElite,
	45: Race.PanzerElite
};

const LEADERBOARD_TYPE_LABELS: Record<number, string> = {
	4: '1 VS. 1',
	5: '1 VS. 1',
	6: '1 VS. 1',
	7: '1 VS. 1',
	8: '2 VS. 2',
	9: '2 VS. 2',
	10: '2 VS. 2',
	11: '2 VS. 2',
	12: '3 VS. 3',
	13: '3 VS. 3',
	14: '3 VS. 3',
	15: '3 VS. 3',
	16: '4 VS. 4',
	17: '4 VS. 4',
	18: '4 VS. 4',
	19: '4 VS. 4',
	0: 'Basic Match',
	1: 'Basic Match',
	2: 'Basic Match',
	3: 'Basic Match',
	42: 'Skirmish',
	43: 'Skirmish',
	44: 'Skirmish',
	45: 'Skirmish',
	46: 'Operation: Assault',
	47: 'Operation: Assault',
	50: 'Operation: Panzerkrieg',
	51: 'Operation: Panzerkrieg',
	54: 'Operation: Stonewall',
	55: 'Operation: Stonewall'
};

/** Filename under `@company-of-heroes/shared-assets/factions`. Hosts resolve to a URL. */
const RACE_FLAG_FILENAME: Record<Race, string> = {
	[Race.US]: 'us.png',
	[Race.Wehrmacht]: 'wm.png',
	[Race.Commonwealth]: 'cw.png',
	[Race.PanzerElite]: 'pe.png'
};

function getRace(leaderboardId: number): Race {
	return LEADERBOARD_RACE_MAP[leaderboardId] ?? Race.US;
}

function getRacePrefix(race: Race): string {
	switch (race) {
		case Race.US:
			return 'us';
		case Race.Wehrmacht:
			return 'heer';
		case Race.Commonwealth:
			return 'brit';
		case Race.PanzerElite:
			return 'panzer';
		default:
			return 'us';
	}
}

export function getRankImageByLeaderboardId(leaderboardId: number, ranklevel?: number): string {
	const prefix = getRacePrefix(getRace(leaderboardId));
	if (ranklevel === undefined || ranklevel <= 0 || !Number.isInteger(ranklevel)) {
		return '/ranks/no_rank_yet.png';
	}
	return `/ranks/${prefix}_${ranklevel.toString().padStart(2, '0')}.png`;
}

/** Rank badge for a faction race id (0–3) and Relic rank level. */
export function getRankImageByRace(raceId: number, ranklevel?: number): string {
	const race =
		raceId === Race.US ||
		raceId === Race.Wehrmacht ||
		raceId === Race.Commonwealth ||
		raceId === Race.PanzerElite
			? raceId
			: Race.US;
	const prefix = getRacePrefix(race);
	if (ranklevel === undefined || ranklevel <= 0 || !Number.isInteger(ranklevel)) {
		return '/ranks/no_rank_yet.png';
	}
	return `/ranks/${prefix}_${ranklevel.toString().padStart(2, '0')}.png`;
}

export function getFactionFlagFilenameByLeaderboardId(leaderboardId: number): string {
	return RACE_FLAG_FILENAME[getRace(leaderboardId)];
}

export function getFactionFlagFilenameByRace(raceId: number): string {
	const race =
		raceId === Race.US ||
		raceId === Race.Wehrmacht ||
		raceId === Race.Commonwealth ||
		raceId === Race.PanzerElite
			? raceId
			: Race.US;
	return RACE_FLAG_FILENAME[race];
}

export function getLeaderboardTypeLabel(leaderboardId: number, fallback = 'Unknown'): string {
	return LEADERBOARD_TYPE_LABELS[leaderboardId] || fallback;
}

export function formatStreak(streak: number): string {
	if (streak > 0) return `+${streak}`;
	return String(streak);
}

export function streakClass(streak: number): string {
	if (streak > 0) return 'text-green-300 tabular-nums';
	if (streak < 0) return 'text-red-300 tabular-nums';
	return 'text-secondary-400 tabular-nums';
}
