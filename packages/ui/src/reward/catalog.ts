import { rewardCategory, ribbonSeriesMap, type RewardCategory, type Ribbon } from './ribbon';
import type { PlayerRewards, RewardView } from './types';

export type CatalogEntry =
	| { kind: 'single'; key: string; category: RewardCategory; reward: RewardView }
	| {
			kind: 'series';
			key: string;
			category: RewardCategory;
			/** Title of the first level without its numeral ("US Command I" → "US Command"); empty when the levels are not numbered. */
			name: string;
			/** Level 1 first; secret levels still locked are left out. */
			levels: RewardView[];
			/** Each level's position in the series (1 = I), so a hidden level does not shift the numerals. */
			numbers: number[];
			/** Levels in the series up to its highest shown one, so hidden levels in between still count. */
			total: number;
	  };

/**
 * The catalog as wiki rows: a ranked series (same ribbon, levels 1 to 5) becomes one row.
 * With a player, their version of each reward (unlock date, the owner's progress) replaces
 * the catalog's; secret rewards only show once that player unlocked them.
 */
export function catalogEntries(
	catalog: RewardView[],
	player: PlayerRewards | null,
	ribbons: Ribbon[]
): CatalogEntry[] {
	const theirs = new Map((player?.rewards ?? []).map((reward) => [reward.id, reward]));
	const ribbonByKey = new Map(ribbons.map((ribbon) => [ribbon.key, ribbon]));
	const seriesOf = ribbonSeriesMap(ribbons);
	const entries: CatalogEntry[] = [];
	const series = new Map<string, Extract<CatalogEntry, { kind: 'series' }>>();
	for (const item of catalog) {
		const reward = theirs.get(item.id) ?? item;
		if (reward.secret && !reward.title) {
			continue;
		}

		const ribbon = reward.ribbon ? ribbonByKey.get(reward.ribbon) : undefined;
		const category = rewardCategory(reward, ribbon);
		const level = reward.ribbon ? seriesOf.get(reward.ribbon) : undefined;
		if (!level) {
			entries.push({ kind: 'single', key: reward.id, category, reward });
			continue;
		}

		const existing = series.get(level.series);
		if (existing) {
			existing.levels.push(reward);
			continue;
		}

		const entry = {
			kind: 'series' as const,
			key: level.series,
			category,
			name: '',
			levels: [reward],
			numbers: [],
			total: 0
		};
		series.set(level.series, entry);
		entries.push(entry);
	}

	for (const entry of series.values()) {
		const levelOf = (reward: RewardView) => seriesOf.get(reward.ribbon ?? '')?.level ?? 0;
		entry.levels.sort((a, b) => levelOf(a) - levelOf(b));
		// Levels without a ribbon level number on after the highest real one, so none collide.
		let next = Math.max(0, ...entry.levels.map(levelOf));
		entry.numbers = entry.levels.map((reward) => levelOf(reward) || ++next);
		entry.total = Math.max(entry.levels.length, ...entry.numbers);
		const numbered = /\s+[IVX]+$/;
		entry.name = numbered.test(entry.levels[0].title)
			? entry.levels[0].title.replace(numbered, '')
			: '';
	}

	return entries;
}
