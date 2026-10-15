import type {
	BuildingPage,
	CommanderPage,
	DocKind,
	MapPage,
	UnitPage,
	UpgradePage,
	WeaponPage
} from '@company-of-heroes/game-data/types';

export type DocsNote = { body: string; updated: string };

/** A docs page plus its staff tip (null when there is none). */
export type WithNote<T> = T & { note: DocsNote | null };

export type DocsUnitPageData = WithNote<UnitPage>;
export type DocsBuildingPageData = WithNote<BuildingPage>;
export type DocsCommanderPageData = WithNote<CommanderPage>;
export type DocsWeaponPageData = WithNote<WeaponPage>;
export type DocsMapPageData = WithNote<MapPage>;
export type DocsUpgradePageData = WithNote<UpgradePage>;

/**
 * Map images from `packages/shared-assets/maps` (the host bundles them): the map picture (the
 * loading-screen one, with the start circles), a small one for lists, the territory sector lines
 * drawn over it, and a grey image with the sector id of every territory cell (to colour a sector
 * on hover).
 */
export type DocsMapImage = (
	slug: string,
	variant: 'full' | 'thumb' | 'sectors' | 'sector-ids'
) => string | undefined;

export type { DocKind };
