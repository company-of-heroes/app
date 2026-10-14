import { escapeHtml } from '../attachments/tooltip.svelte';
import type { RewardView } from './types';

/** Service ribbons from `shared-assets/ribbons` (see `scripts/generate-ribbons.mjs` there). */
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

export type Ribbon = {
	/** File name without `.svg`, stored on the reward (e.g. `ribbon-042`). */
	key: string;
	url: string;
	title: string;
	/** Faction the ribbon is styled after (0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite), null for global ones. */
	raceId: number | null;
	pattern: RibbonPattern;
	/** Carries a pin: star, oak leaves, V, arrowhead, swords, rosette, pip or tank. */
	device: boolean;
	/** Ranked ribbons: the series (e.g. `americans-1`) and its level, 1 to 5 devices. */
	series: string | null;
	level: number | null;
};

/** One row of `ribbons.json`. */
export type RibbonManifestEntry = {
	file: string;
	title: string;
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

const fileName = (path: string) =>
	path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);

/** Joins the manifest with the URLs a host's `import.meta.glob` gave for the SVG files. */
export function ribbonsFrom(
	manifest: RibbonManifestEntry[],
	urls: Record<string, string>
): Ribbon[] {
	const byFile = new Map(Object.entries(urls).map(([path, url]) => [fileName(path), url]));
	return manifest.flatMap((entry) => {
		const url = byFile.get(entry.file);
		return url
			? [
					{
						key: entry.file.replace(/\.svg$/, ''),
						url,
						title: entry.title,
						raceId: entry.raceId,
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
 * Faction a reward belongs to: the one its conditions count, else the faction its ribbon is
 * styled after. Null for global rewards (no faction, or conditions for several).
 */
export function rewardRaceId(
	reward: Pick<RewardView, 'conditions'>,
	ribbon: Ribbon | undefined
): number | null {
	const raceIds = new Set(
		(reward.conditions ?? []).flatMap((condition) =>
			condition.filter?.raceId !== undefined ? [condition.filter.raceId] : []
		)
	);
	if (raceIds.size > 1) {
		return null;
	}

	if (raceIds.size === 1) {
		return [...raceIds][0];
	}

	return ribbon?.raceId ?? null;
}
