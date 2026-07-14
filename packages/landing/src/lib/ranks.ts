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
	5: Race.Wehrmacht,
	9: Race.Wehrmacht,
	13: Race.Wehrmacht,
	17: Race.Wehrmacht,
	6: Race.Commonwealth,
	10: Race.Commonwealth,
	14: Race.Commonwealth,
	18: Race.Commonwealth,
	7: Race.PanzerElite,
	11: Race.PanzerElite,
	15: Race.PanzerElite,
	19: Race.PanzerElite
};

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
	const race = LEADERBOARD_RACE_MAP[leaderboardId] ?? Race.US;
	const prefix = getRacePrefix(race);

	if (ranklevel === undefined || ranklevel <= 0 || !Number.isInteger(ranklevel)) {
		return '/ranks/no_rank_yet.png';
	}

	return `/ranks/${prefix}_${ranklevel.toString().padStart(2, '0')}.png`;
}
