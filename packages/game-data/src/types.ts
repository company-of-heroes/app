/** Shapes of the JSON in `data/`, written by `company-of-heroes-assets/tools/extract_docs.py`. */

export type Faction = 'allies' | 'allies_commonwealth' | 'axis' | 'axis_panzer_elite';

export type DocKind = 'unit' | 'building' | 'commander' | 'weapon';

export type DocCost = {
	manpower?: number;
	munition?: number;
	fuel?: number;
	/** Command points (commander tree unlocks). */
	command?: number;
	seconds?: number;
};

export type DocByRange = { short: number | null; medium: number | null; long: number | null };

/** One modifier effect, e.g. `received_accuracy_modifier` ×0.8 on the squad. */
export type DocModifier = {
	type: string;
	value?: number;
	usage?: 'multiplication' | 'addition' | 'enable' | string;
	applies?: string;
	/** Hardpoint (`hardpoint_01`), ability or weapon slug the effect is limited to. */
	target?: string;
};

export type DocVeterancyRank = {
	rank: number;
	experience?: number;
	effects: DocModifier[];
};

export type DocModel = {
	slug: string;
	name?: string;
	count: number;
	hitpoints?: number;
	speed?: number;
	sight?: number;
	targetType?: string;
	pop?: number;
	cost?: DocCost;
	weapons?: string[];
};

export type DocUnit = {
	slug: string;
	/** Replay objectId: index in the game's sorted blueprint list. */
	id?: number;
	faction: Faction;
	kind?: 'soldiers' | 'vehicles';
	name: string;
	help?: string;
	/** Usually "Good vs. …". */
	extra?: string;
	icon?: string;
	cost?: DocCost;
	pop?: number;
	reinforce?: DocCost;
	size?: number;
	models?: DocModel[];
	/** In-game 1–10 ratings (`infantry`, `lightarmor`, `heavyarmor`, `structures`). */
	ratings?: Record<string, number>;
	/** Suppression recovery and speed per cover type; only types that differ from 1. */
	cover?: Record<string, DocUnitCover>;
	abilities?: string[];
	upgrades?: string[];
	veterancy?: DocVeterancyRank[];
	/** Building or squad (Commonwealth trucks) slugs. */
	producedBy?: string[];
	/** Doctrine call-in ability, when no building produces it; `cost` is then that call-in's cost. */
	callIn?: string;
};

export type DocBuilding = {
	slug: string;
	/** Replay objectId: index in the game's sorted blueprint list. */
	id?: number;
	faction: Faction;
	name: string;
	help?: string;
	extra?: string;
	icon?: string;
	cost?: DocCost;
	hitpoints?: number;
	produces?: string[];
	research?: string[];
	abilities?: string[];
	weapons?: string[];
};

export type DocCommander = {
	slug: string;
	/** Replay objectId of the doctrine pick (its lock upgrade). */
	id?: number;
	faction: Faction;
	name: string;
	help?: string;
	icon?: string;
	portrait?: string;
	/** Upgrade that picks this commander. */
	unlock?: string;
	/** Two branches of upgrade slugs, top tier last. */
	branches?: string[][];
};

export type DocUpgrade = {
	slug: string;
	/** Replay objectId: index in the game's sorted blueprint list. */
	id?: number;
	factions: Faction[];
	name: string;
	help?: string;
	extra?: string;
	icon?: string;
	cost?: DocCost;
	requires?: string[];
	unlocks?: { units?: string[]; abilities?: string[]; upgrades?: string[] };
	effects?: DocModifier[];
	/** Weapons of the slot items it adds (weapon packages). */
	weapons?: string[];
};

export type DocAbility = {
	slug: string;
	/** Replay objectId: index in the game's sorted blueprint list. */
	id?: number;
	factions: Faction[];
	name: string;
	help?: string;
	extra?: string;
	icon?: string;
	cost?: DocCost;
	recharge?: number;
	range?: number;
	duration?: number;
	requires?: string[];
	spawns?: string[];
	weapons?: string[];
	effects?: DocModifier[];
};

export type DocWeaponTarget = {
	damage?: number;
	accuracy?: number;
	penetration?: number;
	suppression?: number;
};

/** A weapon's multipliers against a target in one cover type. */
export type DocCoverMultipliers = {
	accuracy?: number;
	damage?: number;
	penetration?: number;
	suppression?: number;
};

/** How a squad fares in one cover type. */
export type DocUnitCover = {
	/** Suppression recovery rate multiplier. */
	suppressionRecovery?: number;
	/** Move speed multiplier. */
	speed?: number;
};

export type DocWeapon = {
	slug: string;
	factions: Faction[];
	name: string;
	kind?: string;
	icon?: string;
	damage?: { min: number | null; max: number | null };
	accuracy?: DocByRange;
	penetration?: DocByRange;
	suppression?: DocByRange;
	range?: Partial<DocByRange> & { min: number | null; max: number | null };
	cooldown?: { min: number | null; max: number | null };
	reload?: { min: number | null; max: number | null; frequency: number | null };
	aim?: number;
	burst?: number;
	rateOfFire?: number;
	movingAccuracy?: number;
	canFireMoving?: boolean;
	setup?: number;
	teardown?: number;
	areaRadius?: number;
	areaDamage?: DocByRange;
	/** Multipliers against target types that differ from 1. */
	targets?: Record<string, DocWeaponTarget>;
	/** Multipliers against a target in each cover type (`tp_heavy`, `tp_light`, …); only types that differ from 1. */
	cover?: Record<string, DocCoverMultipliers>;
};

export type DocMeta = {
	generatedAt: string;
	gameBuild: string;
	counts: Record<string, number>;
};

/** A link to another documented item with what a list row needs. */
export type DocRef = {
	kind: DocKind | 'ability' | 'upgrade';
	slug: string;
	/** Replay objectId (doctrine id for commanders); opens the stats popover. */
	id?: number;
	/** Upgrades that add a weapon: that weapon's slug, so the upgrade links to the weapon page. */
	weapon?: string;
	name: string;
	icon?: string;
	faction?: Faction;
	cost?: DocCost;
};

/** A weapon in the weapons table: its ref with the numbers the table shows. */
export type DocWeaponRow = DocRef &
	Pick<DocWeapon, 'damage' | 'range' | 'accuracy'> & {
		/** Units and buildings that carry it, or can get it from an upgrade. */
		usedBy: number;
	};

export type CommanderTier = {
	upgrade: DocUpgrade;
	/** Abilities this tier unlocks (call-ins, off-map strikes, …). */
	abilities: DocAbility[];
	/** Units called in by those abilities or the upgrade itself. */
	units: DocRef[];
};

export type UnitCallIn = { commander: DocRef; tier: DocRef; ability?: DocRef };

/** An upgrade in a page list, with links to the weapons it adds. */
export type DocUpgradeEntry = DocUpgrade & {
	/** The one weapon the upgrade is about (title link); see `GameDocs.mainWeapon`. */
	weapon?: string;
	/** Every weapon it adds, also through the abilities it unlocks. */
	weaponRefs: DocRef[];
};

export type UnitPage = {
	unit: DocUnit;
	weapons: DocWeapon[];
	/** With the upgrades each ability needs (`requiredRefs`, e.g. Mk2 Grenades for Throw Grenade). */
	abilities: (DocAbility & { requiredRefs: DocRef[] })[];
	upgrades: DocUpgradeEntry[];
	/** Building research that applies to this unit (BARs for riflemen), with where it is researched. */
	research: (DocUpgradeEntry & { researchedAt: DocRef[] })[];
	/** Panzer Elite veterancy, bought per rank on one of two tracks, in rank order. */
	vetUpgrades: { offensive: DocUpgradeEntry[]; defensive: DocUpgradeEntry[] };
	producedBy: DocRef[];
	calledInBy: UnitCallIn[];
};

export type BuildingPage = {
	building: DocBuilding;
	produces: DocRef[];
	research: DocUpgradeEntry[];
	abilities: DocAbility[];
	weapons: DocWeapon[];
};

export type CommanderPage = {
	commander: DocCommander;
	branches: CommanderTier[][];
};

export type WeaponPage = {
	weapon: DocWeapon;
	usedBy: DocRef[];
	/** Upgrades that add this weapon, with the units (or the building) that get it. */
	upgradeFor: { upgrade: DocRef; units: DocRef[] }[];
};

export type FactionOverview = {
	faction: Faction;
	/** Buildings that produce units, with what they produce and the upgrades researched there. */
	buildings: (DocRef & {
		/** "HQ", "T1", …; missing for producers outside the tech order. */
		tier?: string;
		produces: DocRef[];
		research: DocRef[];
	})[];
	/** Defenses, emplacements and other structures (one per name). */
	structures: DocRef[];
	/** Units no building produces: commander call-ins, emplacement crews, starting units. */
	otherUnits: DocRef[];
	commanders: DocRef[];
};

export type DocsOverview = {
	meta: DocMeta;
	factions: FactionOverview[];
};
