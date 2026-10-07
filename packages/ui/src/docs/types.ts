import type {
	BuildingPage,
	CommanderPage,
	DocKind,
	UnitPage,
	WeaponPage
} from '@company-of-heroes/game-data/types';

export type DocsNote = { body: string; updated: string };

/** A docs page plus its staff tip (null when there is none). */
export type WithNote<T> = T & { note: DocsNote | null };

export type DocsUnitPageData = WithNote<UnitPage>;
export type DocsBuildingPageData = WithNote<BuildingPage>;
export type DocsCommanderPageData = WithNote<CommanderPage>;
export type DocsWeaponPageData = WithNote<WeaponPage>;

export type { DocKind };
