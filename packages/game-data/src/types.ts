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
	/** In-game 1–5 ratings (`infantry`, `lightarmor`, `heavyarmor`, `structures`). */
	ratings?: Record<string, number>;
	abilities?: string[];
	upgrades?: string[];
	veterancy?: DocVeterancyRank[];
	/** Building or squad (Commonwealth trucks) slugs. */
	producedBy?: string[];
};

export type DocBuilding = {
	slug: string;
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
	factions: Faction[];
	name: string;
	help?: string;
	extra?: string;
	icon?: string;
	cost?: DocCost;
	requires?: string[];
	unlocks?: { units?: string[]; abilities?: string[]; upgrades?: string[] };
	effects?: DocModifier[];
};

export type DocAbility = {
	slug: string;
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
	name: string;
	icon?: string;
	faction?: Faction;
	cost?: DocCost;
};

export type CommanderTier = {
	upgrade: DocUpgrade;
	/** Abilities this tier unlocks (call-ins, off-map strikes, …). */
	abilities: DocAbility[];
	/** Units called in by those abilities or the upgrade itself. */
	units: DocRef[];
};

export type UnitCallIn = { commander: DocRef; tier: DocRef; ability?: DocRef };

export type UnitPage = {
	unit: DocUnit;
	weapons: DocWeapon[];
	abilities: DocAbility[];
	upgrades: DocUpgrade[];
	producedBy: DocRef[];
	calledInBy: UnitCallIn[];
};

export type BuildingPage = {
	building: DocBuilding;
	produces: DocRef[];
	research: DocUpgrade[];
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
};

export type FactionOverview = {
	faction: Faction;
	/** Buildings that produce units, with what they produce. */
	buildings: (DocRef & { produces: DocRef[] })[];
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
