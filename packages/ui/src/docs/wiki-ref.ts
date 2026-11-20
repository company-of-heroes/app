/**
 * A wiki page referenced from guide markdown, optionally with its icon key:
 * `/wiki/units/riflemen?icon=units_unit_allied_rifleman`. Links (`[Riflemen](…)`) get the icon in
 * front of their text; images (`![Riflemen](…)`) show the icon as a framed tile that links to the
 * page. The key is stored (not the icon url) because icon urls differ per host and per build.
 */
export type WikiRef = {
	/** The page path without the query (`/wiki/units/riflemen`). */
	path: string;
	kind: string;
	slug: string;
	icon: string | null;
};

const WIKI_REF =
	/^\/wiki\/(units|buildings|commanders|upgrades|weapons|maps)\/([a-z0-9-]+)\/?(?:\?icon=([a-z0-9_]+))?$/;

export function parseWikiRef(href: string | null | undefined): WikiRef | null {
	const match = href ? WIKI_REF.exec(href) : null;
	if (!match) {
		return null;
	}

	return {
		path: `/wiki/${match[1]}/${match[2]}`,
		kind: match[1],
		slug: match[2],
		icon: match[3] ?? null
	};
}

/** The markdown href for a wiki page and its icon. */
export function wikiRefHref(path: string, icon?: string | null): string {
	return icon ? `${path}?icon=${icon}` : path;
}
