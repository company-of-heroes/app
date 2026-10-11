import type { DocsMapImage } from '@company-of-heroes/ui/docs';

/**
 * Wiki map images (`tools/extract_wiki_maps.py`): `<slug>.webp`, `<slug>-thumb.webp`,
 * `<slug>-sectors.webp` and `<slug>-sector-ids.png`.
 */
const mapModules = import.meta.glob<string>('../../../../shared-assets/maps/*.{webp,png}', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const mapsByName = new Map(
	Object.entries(mapModules).map(([path, url]) => [
		path.replace(/^.*[/]/, '').replace(/\.(webp|png)$/, ''),
		url
	])
);

const SUFFIX = {
	full: '',
	thumb: '-thumb',
	sectors: '-sectors',
	'sector-ids': '-sector-ids'
} as const;

export const getWikiMapImage: DocsMapImage = (slug, variant) =>
	mapsByName.get(`${slug}${SUFFIX[variant]}`);
