import { loadGameDocs, type DocKind, type GameDocs } from '@company-of-heroes/game-data';
import type { WithNote } from '@company-of-heroes/ui/docs';
import { api, unwrapApi } from '$core/api';

/**
 * Wiki pages in the app, like the website's `DocsService`: generated game data from
 * `@company-of-heroes/game-data` plus the staff tip of each page. Null for an unknown slug.
 */
async function page<T>(
	kind: DocKind,
	slug: string,
	build: (docs: GameDocs) => T | undefined
): Promise<WithNote<T> | null> {
	const found = build(await loadGameDocs());
	if (!found) {
		return null;
	}

	// The game data is bundled; a failing tip lookup only hides the tip.
	const note = await unwrapApi(api.docs.note(kind, slug)).catch(() => null);
	return { ...found, note };
}

export const wiki = {
	overview: () => loadGameDocs().then((docs) => docs.overview()),
	weapons: () => loadGameDocs().then((docs) => docs.weaponList()),
	maps: () => loadGameDocs().then((docs) => docs.mapList()),
	unit: (slug: string) => page('unit', slug, (docs) => docs.unitPage(slug)),
	building: (slug: string) => page('building', slug, (docs) => docs.buildingPage(slug)),
	commander: (slug: string) => page('commander', slug, (docs) => docs.commanderPage(slug)),
	weapon: (slug: string) => page('weapon', slug, (docs) => docs.weaponPage(slug)),
	map: (slug: string) => page('map', slug, (docs) => docs.mapPage(slug))
};
