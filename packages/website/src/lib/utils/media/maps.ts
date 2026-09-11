const mapModules = import.meta.glob<{ default: string }>(
	'../../../../../app/src/lib/files/maps/*_map_base.png',
	{ eager: true }
);

const defaultMapModules = import.meta.glob<{ default: string }>(
	'../../../../../app/src/lib/files/maps/mp_nobattlemap.png',
	{ eager: true }
);

const mapCache = new Map<string, string>();

function registerMapKey(key: string, url: string) {
	const normalized = key.trim().toLowerCase().replace(/\s+/g, ' ');
	if (!normalized) {
		return;
	}

	mapCache.set(normalized, url);
	const withSpaces = normalized.replace(/_/g, ' ');
	if (withSpaces !== normalized) {
		mapCache.set(withSpaces, url);
	}

	const withUnderscores = normalized.replace(/ /g, '_');
	if (withUnderscores !== normalized) {
		mapCache.set(withUnderscores, url);
	}

	const withoutPrefix = normalized.replace(/^\d+p[_ ]/, '');
	if (withoutPrefix !== normalized) {
		registerMapKey(withoutPrefix, url);
	}
}

function getMapLookupCandidates(mapName: string): string[] {
	const candidates = new Set<string>();
	let base = mapName.trim().toLowerCase();
	base = base.split(/[/\\]/).pop() ?? base;
	base = base.replace(/\.(sgb|rev|map|png|webp|jpg|jpeg)$/i, '');
	base = base.replace(/_map_base$/, '');
	base = base.replace(/\s+/g, ' ').trim();
	if (!base) {
		return [];
	}

	candidates.add(base);
	candidates.add(base.replace(/_/g, ' '));
	candidates.add(base.replace(/ /g, '_'));
	const displayMatch = base.match(/^(.+?)\s*\((\d+)\)\s*$/);
	if (displayMatch) {
		const [, name, count] = displayMatch;
		const slug = name.trim();
		candidates.add(`${count}p_${slug}`);
		candidates.add(`${count}p ${slug}`);
		candidates.add(`${count}p_${slug.replace(/ /g, '_')}`);
	}

	return [...candidates];
}

for (const [path, module] of Object.entries(mapModules)) {
	const match = path.match(/[/\\]maps[/\\](.+)_map_base\.png$/i);
	if (match) {
		registerMapKey(match[1], module.default);
	}
}

const defaultMapImage =
	Object.values(defaultMapModules)[0]?.default ?? Object.values(mapModules)[0]?.default ?? '';

export function getMapImageFromName(mapName: string | undefined): string {
	if (!mapName || typeof mapName !== 'string') {
		return defaultMapImage;
	}

	for (const candidate of getMapLookupCandidates(mapName)) {
		const cached = mapCache.get(candidate);
		if (cached) {
			return cached;
		}
	}
	return defaultMapImage;
}
