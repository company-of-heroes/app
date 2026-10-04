import us from '@company-of-heroes/shared-assets/factions/us.png';
import wm from '@company-of-heroes/shared-assets/factions/wm.png';
import cw from '@company-of-heroes/shared-assets/factions/cw.png';
import pe from '@company-of-heroes/shared-assets/factions/pe.png';

/**
 * Game images. Maps and doctrine banners live in the companion app; relative globs
 * (not kit aliases) so Vite always expands the files, like the website does.
 */
const mapModules = import.meta.glob<string>('../../../app/src/lib/files/maps/*_map_base.png', {
	eager: true,
	import: 'default'
});

const defaultMapModules = import.meta.glob<string>(
	'../../../app/src/lib/files/maps/mp_nobattlemap.png',
	{ eager: true, import: 'default' }
);

const doctrineModules = import.meta.glob<string>(
	'../../../app/src/lib/files/ct_branchbanner_*.png',
	{ eager: true, import: 'default' }
);

/** Action icons (.png) and timeline background art (.webp), same set as the app and website. */
const actionIconModules = import.meta.glob<string>('../../../shared-assets/actions/*.{png,webp}', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const fileName = (path: string) => path.replace(/^.*[\/\\]/, '');

const mapsByKey = new Map<string, string>();
for (const [path, url] of Object.entries(mapModules)) {
	const key = fileName(path)
		.replace(/_map_base\.png$/i, '')
		.toLowerCase();
	mapsByKey.set(key, url);
	mapsByKey.set(key.replace(/ /g, '_'), url);
	mapsByKey.set(key.replace(/_/g, ' '), url);
}

const doctrinesByFile = new Map(
	Object.entries(doctrineModules).map(([path, url]) => [fileName(path), url] as const)
);

const actionIconsByKey = new Map(
	Object.entries(actionIconModules).map(
		([path, url]) => [fileName(path).replace(/\.(png|webp)$/, ''), url] as const
	)
);

export const defaultMapImage =
	Object.values(defaultMapModules)[0] ?? Object.values(mapModules)[0] ?? '';

/** Map key from a replay `mapFileName` (`DATA:scenarios\mp\…\6p_close_river_combat`). */
export function mapKey(mapFileName: string | undefined): string {
	return (
		(mapFileName ?? '')
			.split(/[\/\\]/)
			.pop()
			?.toLowerCase() ?? ''
	);
}

export function mapImage(map: string | undefined): string {
	const key = mapKey(map);
	return mapsByKey.get(key) ?? mapsByKey.get(key.replace(/_/g, ' ')) ?? defaultMapImage;
}

/** 0 = US, 1 = Wehrmacht, 2 = Commonwealth, 3 = Panzer Elite. */
export function factionFlag(race: number): string {
	return [us, wm, cw, pe][race] ?? us;
}

export function doctrineBanner(file: string): string {
	return doctrinesByFile.get(file) ?? '';
}

export function actionIcon(key: string): string | undefined {
	return actionIconsByKey.get(key);
}
