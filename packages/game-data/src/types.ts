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

export type DocByRange = {
	short: number | null;
	medium: number | null;
	long: number | null;
	/** From long range up to max range; only on weapons whose distant band reaches past long. */
	distant?: number | null;
};

/** What has to be done first: upgrades (all of them), `or` groups of upgrades, buildings (one of each group). */
export type DocRequirements = {
	requires?: string[];
	requiresAny?: string[][];
	requiresBuildings?: string[][];
	/** Upgrades that must not be done (bunker upgrades exclude each other). */
	excludes?: string[];
};

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
	/** Weapons beyond the models' own, from upgrades the squad always has (Tank Busters' Panzerschrecks). */
	weapons?: string[];
	/** Weapons a vehicle mounts while infantry is loaded (the M3's .50 cal). */
	loadedWeapons?: string[];
	/** Squads that construct it (the 88mm Flak by Pioneers). */
	builtBy?: string[];
	/** British emplacement whose gun this crew is; `cost` is then the emplacement's. */
	emplacement?: string;
	/** Needs a medal reward; it then replaces the units in `replaces` (Hellcat → M10). */
	reward?: boolean;
	replaces?: string[];
} & DocRequirements;

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
	/** British emplacements: the gun squad that spawns once built. */
	crew?: string[];
	/** Squads that construct it; HQs and gliders have none. */
	builtBy?: string[];
	/** Glider call-in ability that lands it; `cost` is then that call-in's cost. */
	callIn?: string;
} & DocRequirements;

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
	unlocks?: { units?: string[]; abilities?: string[]; upgrades?: string[]; buildings?: string[] };
	effects?: DocModifier[];
	/** Weapons it adds: through slot items (weapon packages) or directly (the Sherman 76mm). */
	weapons?: string[];
	/** Squads it changes (the BAR research → Riflemen, Kampfkraft veterancy → infantry). */
	appliesTo?: string[];
} & DocRequirements;

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
	spawns?: string[];
	/** Buildings it lands (Commando gliders). */
	buildings?: string[];
	weapons?: string[];
	effects?: DocModifier[];
	/** Needs a medal reward upgrade: a skin variant of another call-in (Voss Tiger). */
	reward?: boolean;
} & DocRequirements;

export type DocWeaponTarget = {
	damage?: number;
	accuracy?: number;
	movingAccuracy?: number;
	penetration?: number;
	/** Penetration multiplier against the target's rear armour. */
	rearPenetration?: number;
	suppression?: number;
	/** The weapon cannot fire at this target type at all. */
	disabled?: boolean;
};

/** A time span with its per-range multipliers (only when one differs from 1). */
export type DocTiming = { min?: number | null; max?: number | null; multipliers?: DocByRange };

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
	cooldown?: DocTiming;
	/** `frequency`: shots between reloads, raw from the game files (its exact meaning is unverified). */
	reload?: DocTiming & { frequency?: number | null; frequencyMax?: number | null };
	/** Fire aim time; `ready`: aiming before the first shot. */
	aim?: DocTiming & { ready?: number };
	burst?: { min: number | null; max: number | null };
	rateOfFire?: { min: number | null; max: number | null };
	movingAccuracy?: number;
	canFireMoving?: boolean;
	setup?: number;
	teardown?: number;
	areaRadius?: number;
	areaDamage?: DocByRange;
	/** Distance from the impact where each area damage band ends. */
	areaDistance?: DocByRange;
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
	/** Units unlocked by a medal reward (Hellcat); shown with a badge. */
	reward?: boolean;
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
	/** Buildings it unlocks or lands (mines, emplacements, gliders). */
	buildings: DocRef[];
	/** Weapons the tier itself adds (APCR rounds, the Rangers' bazookas). */
	weapons: DocRef[];
};

export type UnitCallIn = { commander: DocRef; tier: DocRef; ability?: DocRef };

/** An upgrade in a page list, with links to the weapons it adds. */
export type DocUpgradeEntry = DocUpgrade & {
	/** The one weapon the upgrade is about (title link); see `GameDocs.mainWeapon`. */
	weapon?: string;
	/** Every weapon it adds, also through the abilities it unlocks. */
	weaponRefs: DocRef[];
	/** Upgrades to do first (Level 2 Production → Level 1), and ones it cannot be combined with. */
	requiredRefs: DocRef[];
	excludedRefs: DocRef[];
	/** Units it changes (the BAR research → Riflemen). */
	appliesToRefs: DocRef[];
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
	/** Weapons mounted while loaded. */
	loadedWeapons: DocWeapon[];
	producedBy: DocRef[];
	calledInBy: UnitCallIn[];
	builtBy: DocRef[];
	emplacement?: DocRef;
	/** Upgrades that must be done first, and buildings (one of each group). */
	requires: DocRef[];
	requiresBuildings: DocRef[][];
	/** Medal reward swaps: the units it replaces, or the reward units that replace it. */
	replaces: DocRef[];
	replacedBy: DocRef[];
};

export type BuildingPage = {
	building: DocBuilding;
	produces: DocRef[];
	research: DocUpgradeEntry[];
	abilities: DocAbility[];
	weapons: DocWeapon[];
	builtBy: DocRef[];
	crew: DocRef[];
	requires: DocRef[];
	requiresBuildings: DocRef[][];
	/** Doctrine tiers that unlock it, or the glider call-in that lands it. */
	unlockedBy: UnitCallIn[];
};

export type CommanderPage = {
	commander: DocCommander;
	/** Abilities picking the doctrine gives at once (Panzer Elite vehicle abilities). */
	onPick: DocAbility[];
	branches: CommanderTier[][];
};

export type WeaponPage = {
	weapon: DocWeapon;
	usedBy: DocRef[];
	/** Upgrades that add this weapon, with the units (or the building) that get it. */
	upgradeFor: { upgrade: DocRef; units: DocRef[] }[];
	/** Abilities that fire it, with the units and buildings that have the ability. */
	firedBy: { ability: DocRef; units: DocRef[] }[];
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
