import {
	formatStreak,
	getFactionFlagByLeaderboardId,
	getFactionFlagByRace,
	getLeaderboardTypeLabel,
	streakClass
} from '@company-of-heroes/ui/format/ranks';

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

/**
 * Eagerly load rank images from shared-assets.
 * Relative glob (not kit alias) so Rolldown/Vite always expands the files.
 */
const rankModules = import.meta.glob<{ default: string }>(
	'../../../../../shared-assets/ranks/*.png',
	{ eager: true }
);

const rankImagesByFilename = new Map(
	Object.entries(rankModules).map(([path, module]) => {
		const filename = path.replace(/^.*[\\/]/, '');
		return [filename, module.default] as const;
	})
);

const NO_RANK_IMAGE = rankImagesByFilename.get('no_rank_yet.png') ?? '';
const rankCache = new Map<string, string>();

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

export function getRankImageByRace(raceId: number, ranklevel?: number): string {
	const race =
		raceId === Race.US ||
		raceId === Race.Wehrmacht ||
		raceId === Race.Commonwealth ||
		raceId === Race.PanzerElite
			? raceId
			: Race.US;
	const cacheKey = `${race}-${ranklevel}`;
	if (rankCache.has(cacheKey)) {
		return rankCache.get(cacheKey)!;
	}

	const prefix = getRacePrefix(race);
	if (ranklevel === undefined || ranklevel <= 0 || !Number.isInteger(ranklevel)) {
		rankCache.set(cacheKey, NO_RANK_IMAGE);
		return NO_RANK_IMAGE;
	}

	const filename = `${prefix}_${ranklevel.toString().padStart(2, '0')}.png`;
	const result = rankImagesByFilename.get(filename) ?? NO_RANK_IMAGE;
	rankCache.set(cacheKey, result);
	return result;
}

export function getRankImageByLeaderboardId(leaderboardId: number, ranklevel?: number): string {
	return getRankImageByRace(getRace(leaderboardId), ranklevel);
}

export {
	formatStreak,
	getFactionFlagByLeaderboardId,
	getFactionFlagByRace,
	getLeaderboardTypeLabel,
	streakClass
};
