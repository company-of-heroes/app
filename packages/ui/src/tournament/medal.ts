/** Champion medals from `shared-assets/medals` (see `scripts/generate-medals.mjs` there). */
export type MedalMetal = 'gold' | 'silver' | 'bronze';

export type Medal = {
	/** File name without `.svg`, stored on the tournament (e.g. `medal-042`). */
	key: string;
	url: string;
	title: string;
	metal: MedalMetal;
	shape: string;
};

/** One row of `medals.json`. */
export type MedalManifestEntry = {
	file: string;
	title: string;
	metal: MedalMetal;
	shape: string;
};

export const MEDAL_METALS: MedalMetal[] = ['gold', 'silver', 'bronze'];

/** What a medal shows: its image and name. */
export type MedalImage = { url: string; title: string };

/**
 * The tournament's picked medal: an uploaded one (`customMedal`) or a built-in one by key; null
 * for the default (or a medal that no longer exists).
 */
export function resolveMedal(
	tournament: { medal: string | null; customMedal?: { name: string; imageUrl: string } | null },
	builtIns: Medal[]
): MedalImage | null {
	if (tournament.customMedal) {
		return { url: tournament.customMedal.imageUrl, title: tournament.customMedal.name };
	}

	const medal = builtIns.find((entry) => entry.key === tournament.medal);
	return medal ? { url: medal.url, title: medal.title } : null;
}

const fileName = (path: string) =>
	path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);

/** Joins the manifest with the URLs a host's `import.meta.glob` gave for the SVG files. */
export function medalsFrom(manifest: MedalManifestEntry[], urls: Record<string, string>): Medal[] {
	const byFile = new Map(Object.entries(urls).map(([path, url]) => [fileName(path), url]));
	return manifest.flatMap((entry) => {
		const url = byFile.get(entry.file);
		return url
			? [
					{
						key: entry.file.replace(/\.svg$/, ''),
						url,
						title: entry.title,
						metal: entry.metal,
						shape: entry.shape
					}
				]
			: [];
	});
}
