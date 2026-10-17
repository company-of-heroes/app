import { escapeHtml } from '../attachments/tooltip.svelte';
import { getRaceLabel } from '../format/player-format';
import type { RewardView } from './types';

/** Service ribbons from `shared-assets/ribbons/<faction>/` (see `scripts/generate-ribbons.mjs` there). */
export type RibbonPattern =
	| 'bands'
	| 'edged'
	| 'pinstripes'
	| 'split'
	| 'campaign'
	| 'striped'
	| 'rainbow'
	| 'flag'
	| 'fieldgrey'
	| 'theatre'
	| 'piped';

/** Folder (and edge colours) a ribbon belongs to. */
export type RibbonFaction =
	| 'americans'
	| 'wehrmacht'
	| 'british'
	| 'panzer_elite'
	| 'global'
	| 'supporter';

/** How rewards and ribbons are grouped: a faction's `raceId`, the global set or the supporter set. */
export type RewardCategory = 0 | 1 | 2 | 3 | 'global' | 'supporter';

/** Wiki order: US, Wehrmacht, British, Panzer Elite, global rewards, then supporter rewards. */
export const REWARD_CATEGORY_ORDER: readonly RewardCategory[] = [0, 1, 2, 3, 'global', 'supporter'];

/** English label of a category; callers pass it through `t()`. */
export function rewardCategoryLabel(category: RewardCategory): string {
	if (category === 'global') {
		return 'Global';
	}

	if (category === 'supporter') {
		return 'Supporter';
	}

	return getRaceLabel(category);
}

export type Ribbon = {
	/** File name without `.svg`, stored on the reward (e.g. `ribbon-042`). */
	key: string;
	url: string;
	title: string;
	/** Faction the ribbon is styled after (0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite), null for global and supporter ones. */
	raceId: number | null;
	faction: RibbonFaction;
	category: RewardCategory;
	pattern: RibbonPattern;
	/** Carries a pin: star, oak leaves, V, arrowhead, swords, rosette, pip or tank. */
	device: boolean;
	/** Ranked ribbons: the series (e.g. `americans-1`) and its level, 1 to 5 devices. */
	series: string | null;
	level: number | null;
};

/** One row of `ribbons.json`. */
export type RibbonManifestEntry = {
	/** Path inside `ribbons/`, e.g. `americans/ribbon-001.svg`. */
	file: string;
	title: string;
	faction: RibbonFaction;
	raceId: number | null;
	pattern: RibbonPattern;
	device: unknown;
	series?: string;
	level?: number;
};

/** The ribbon at 1.5× and always in colour, for the top of a reward tooltip. */
export function ribbonTipHtml(ribbon: Ribbon | null | undefined): string {
	return ribbon
		? `<img src="${escapeHtml(ribbon.url)}" alt="" width="105" height="30" class="mb-2 block h-[30px] w-[105px] rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.6)]">`
		: '';
}

/** Key a reward stores for a manifest file: `americans/ribbon-001.svg` → `ribbon-001`. */
export const ribbonKey = (file: string) =>
	file.slice(file.lastIndexOf('/') + 1).replace(/\.svg$/, '');

/** Path after `ribbons/` with forward slashes, so a glob path matches the manifest's `file`. */
const ribbonPath = (path: string) => path.replace(/\\/g, '/').replace(/^.*\/ribbons\//, '');

const ribbonCategory = (entry: RibbonManifestEntry): RewardCategory =>
	entry.faction === 'supporter' ? 'supporter' : ((entry.raceId as RewardCategory) ?? 'global');

/** Joins the manifest with the URLs a host's `import.meta.glob` gave for the SVG files. */
export function ribbonsFrom(
	manifest: RibbonManifestEntry[],
	urls: Record<string, string>
): Ribbon[] {
	const byFile = new Map(Object.entries(urls).map(([path, url]) => [ribbonPath(path), url]));
	return manifest.flatMap((entry) => {
		const url = byFile.get(entry.file);
		return url
			? [
					{
						key: ribbonKey(entry.file),
						url,
						title: entry.title,
						raceId: entry.raceId,
						faction: entry.faction,
						category: ribbonCategory(entry),
						pattern: entry.pattern,
						device: Boolean(entry.device),
						series: entry.series ?? null,
						level: entry.level ?? null
					}
				]
			: [];
	});
}

export type RibbonSeries = {
	series: string;
	level: number;
	/** Highest level in the series. */
	levels: number;
};

/** Ribbon key → its ranked series, its level and the highest level of that series. */
export function ribbonSeriesMap(ribbons: Ribbon[]): Map<string, RibbonSeries> {
	const levels = new Map<string, number>();
	for (const ribbon of ribbons) {
		if (ribbon.series && ribbon.level) {
			levels.set(ribbon.series, Math.max(levels.get(ribbon.series) ?? 0, ribbon.level));
		}
	}

	return new Map(
		ribbons.flatMap((ribbon) =>
			ribbon.series && ribbon.level
				? [
						[
							ribbon.key,
							{
								series: ribbon.series,
								level: ribbon.level,
								levels: levels.get(ribbon.series) ?? ribbon.level
							}
						] as const
					]
				: []
		)
	);
}

/**
 * Category a reward belongs to: supporter when it counts the subscription or wears a supporter
 * ribbon; else the faction its conditions count, else the faction its ribbon is styled after.
 * Global when there is no faction, or conditions for several.
 */
export function rewardCategory(
	reward: Pick<RewardView, 'conditions'>,
	ribbon: Ribbon | undefined
): RewardCategory {
	const conditions = reward.conditions ?? [];
	if (
		ribbon?.category === 'supporter' ||
		conditions.some(
			(condition) =>
				condition.metric === 'supporter_active' || condition.metric === 'supporter_months'
		)
	) {
		return 'supporter';
	}

	const raceIds = new Set(
		conditions.flatMap((condition) =>
			condition.filter?.raceId !== undefined ? [condition.filter.raceId] : []
		)
	);
	if (raceIds.size > 1) {
		return 'global';
	}

	if (raceIds.size === 1) {
		return [...raceIds][0] as RewardCategory;
	}

	return ribbon?.category ?? 'global';
}
