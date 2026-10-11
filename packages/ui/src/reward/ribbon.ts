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
