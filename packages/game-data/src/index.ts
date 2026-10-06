import type {
	BuildingPage,
	CommanderPage,
	CommanderTier,
	DocAbility,
	DocBuilding,
	DocCommander,
	DocMeta,
	DocRef,
	DocsOverview,
	DocUnit,
	DocUpgrade,
	DocWeapon,
	Faction,
	UnitCallIn,
	UnitPage,
	WeaponPage
} from './types';
import { FACTIONS } from './factions';

export type * from './types';
export { FACTIONS, FACTION_RACE_ID, isFaction } from './factions';

function bySlug<T extends { slug: string }>(items: T[]): Map<string, T> {
	return new Map(items.map((item) => [item.slug, item]));
}

function defined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

/** Lookups and reverse links over the generated documentation data. */
export class GameDocs {
	readonly units: Map<string, DocUnit>;
	readonly buildings: Map<string, DocBuilding>;
	readonly commanders: Map<string, DocCommander>;
	readonly upgrades: Map<string, DocUpgrade>;
	readonly abilities: Map<string, DocAbility>;
	readonly weapons: Map<string, DocWeapon>;
	readonly meta: DocMeta;

	constructor(
		meta: DocMeta,
		data: {
			units: DocUnit[];
			buildings: DocBuilding[];
			commanders: DocCommander[];
			upgrades: DocUpgrade[];
			abilities: DocAbility[];
			weapons: DocWeapon[];
		}
	) {
		this.meta = meta;
		this.units = bySlug(data.units);
		this.buildings = bySlug(data.buildings);
		this.commanders = bySlug(data.commanders);
		this.upgrades = bySlug(data.upgrades);
		this.abilities = bySlug(data.abilities);
		this.weapons = bySlug(data.weapons);
	}

	unitRef(slug: string): DocRef | undefined {
		const unit = this.units.get(slug);
		return (
			unit && {
				kind: 'unit',
				slug,
				name: unit.name,
				icon: unit.icon,
				faction: unit.faction,
				cost: unit.cost
			}
		);
	}

	buildingRef(slug: string): DocRef | undefined {
		const building = this.buildings.get(slug);
		return (
			building && {
				kind: 'building',
				slug,
				name: building.name,
				icon: building.icon,
				faction: building.faction,
				cost: building.cost
			}
		);
	}

	commanderRef(slug: string): DocRef | undefined {
		const commander = this.commanders.get(slug);
		return (
			commander && {
				kind: 'commander',
				slug,
				name: commander.name,
				icon: commander.icon,
				faction: commander.faction
			}
		);
	}

	weaponRef(slug: string): DocRef | undefined {
		const weapon = this.weapons.get(slug);
		return weapon && { kind: 'weapon', slug, name: weapon.name, icon: weapon.icon };
	}

	/** A producer is a building or, for Commonwealth trucks, a unit. */
	producerRef(slug: string): DocRef | undefined {
		return this.buildingRef(slug) ?? this.unitRef(slug);
	}

	abilityRef(ability: DocAbility): DocRef {
		return {
			kind: 'ability',
			slug: ability.slug,
			name: ability.name,
			icon: ability.icon,
			cost: ability.cost
		};
	}

	upgradeRef(upgrade: DocUpgrade): DocRef {
		return {
			kind: 'upgrade',
			slug: upgrade.slug,
			name: upgrade.name,
			icon: upgrade.icon,
			cost: upgrade.cost
		};
	}

	/** Commander and branch position of a tier upgrade. */
	tierOf(
		upgradeSlug: string
	): { commander: DocCommander; branch: number; tier: number } | undefined {
		for (const commander of this.commanders.values()) {
			for (const [branch, tiers] of (commander.branches ?? []).entries()) {
				const tier = tiers.indexOf(upgradeSlug);
				if (tier >= 0) {
					return { commander, branch, tier };
				}
			}
		}

		return undefined;
	}

	commanderTier(upgradeSlug: string): CommanderTier | undefined {
		const upgrade = this.upgrades.get(upgradeSlug);
		if (!upgrade) {
			return undefined;
		}

		const abilities = [
			...(upgrade.unlocks?.abilities ?? []).map((slug) => this.abilities.get(slug)).filter(defined),
			...[...this.abilities.values()].filter((ability) => ability.requires?.includes(upgradeSlug))
		].filter((ability, index, all) => all.indexOf(ability) === index);
		const unitSlugs = new Set([
			...(upgrade.unlocks?.units ?? []),
			...abilities.flatMap((ability) => ability.spawns ?? [])
		]);
		return {
			upgrade,
			abilities,
			units: [...unitSlugs].map((slug) => this.unitRef(slug)).filter(defined)
		};
	}

	overview(): DocsOverview {
		const units = [...this.units.values()];
		const buildings = [...this.buildings.values()];
		const commanders = [...this.commanders.values()];
		return {
			meta: this.meta,
			factions: FACTIONS.map((faction) => {
				const own = buildings.filter((building) => building.faction === faction);
				const producing = own.filter((building) => building.produces?.length);
				const produced = new Set(producing.flatMap((building) => building.produces ?? []));
				// Variants share a name (rifleman-built sand bags, a grounded glider); list each name once.
				const seen = new Set<string>();
				const firstByName = (building: DocBuilding) =>
					!seen.has(building.name) && seen.add(building.name);
				return {
					faction,
					buildings: producing.filter(firstByName).map((building) => ({
						...this.buildingRef(building.slug)!,
						produces: (building.produces ?? []).map((slug) => this.unitRef(slug)).filter(defined)
					})),
					structures: own
						.filter((building) => !building.produces?.length)
						.filter(firstByName)
						.map((building) => this.buildingRef(building.slug)!),
					otherUnits: units
						.filter((unit) => unit.faction === faction && !produced.has(unit.slug))
						.map((unit) => this.unitRef(unit.slug)!),
					commanders: commanders
						.filter((commander) => commander.faction === faction)
						.map((commander) => this.commanderRef(commander.slug)!)
				};
			})
		};
	}

	unitPage(slug: string): UnitPage | undefined {
		const unit = this.units.get(slug);
		if (!unit) {
			return undefined;
		}

		const weaponSlugs = new Set((unit.models ?? []).flatMap((model) => model.weapons ?? []));
		const calledInBy: UnitCallIn[] = [];
		for (const commander of this.commanders.values()) {
			for (const tierSlug of (commander.branches ?? []).flat()) {
				const tier = this.commanderTier(tierSlug);
				if (!tier?.units.some((ref) => ref.slug === slug)) {
					continue;
				}

				const ability = tier.abilities.find((item) => item.spawns?.includes(slug));
				calledInBy.push({
					commander: this.commanderRef(commander.slug)!,
					tier: this.upgradeRef(tier.upgrade),
					ability: ability && this.abilityRef(ability)
				});
			}
		}

		return {
			unit,
			weapons: [...weaponSlugs].map((item) => this.weapons.get(item)).filter(defined),
			abilities: (unit.abilities ?? []).map((item) => this.abilities.get(item)).filter(defined),
			upgrades: (unit.upgrades ?? []).map((item) => this.upgrades.get(item)).filter(defined),
			producedBy: (unit.producedBy ?? []).map((item) => this.producerRef(item)).filter(defined),
			calledInBy
		};
	}

	buildingPage(slug: string): BuildingPage | undefined {
		const building = this.buildings.get(slug);
		if (!building) {
			return undefined;
		}

		return {
			building,
			produces: (building.produces ?? []).map((item) => this.unitRef(item)).filter(defined),
			research: (building.research ?? []).map((item) => this.upgrades.get(item)).filter(defined),
			abilities: (building.abilities ?? []).map((item) => this.abilities.get(item)).filter(defined),
			weapons: (building.weapons ?? []).map((item) => this.weapons.get(item)).filter(defined)
		};
	}

	commanderPage(slug: string): CommanderPage | undefined {
		const commander = this.commanders.get(slug);
		if (!commander) {
			return undefined;
		}

		return {
			commander,
			branches: (commander.branches ?? []).map((tiers) =>
				tiers.map((tier) => this.commanderTier(tier)).filter(defined)
			)
		};
	}

	weaponPage(slug: string): WeaponPage | undefined {
		const weapon = this.weapons.get(slug);
		if (!weapon) {
			return undefined;
		}

		const usedBy = [
			...[...this.units.values()]
				.filter((unit) => unit.models?.some((model) => model.weapons?.includes(slug)))
				.map((unit) => this.unitRef(unit.slug)),
			...[...this.buildings.values()]
				.filter((building) => building.weapons?.includes(slug))
				.map((building) => this.buildingRef(building.slug))
		].filter(defined);
		return { weapon, usedBy };
	}

	/** Weapons that a listed unit or building carries, sorted by name. */
	weaponList(): DocRef[] {
		const used = new Set([
			...[...this.units.values()].flatMap((unit) =>
				(unit.models ?? []).flatMap((model) => model.weapons ?? [])
			),
			...[...this.buildings.values()].flatMap((building) => building.weapons ?? [])
		]);
		return [...used]
			.map((slug) => this.weaponRef(slug))
			.filter(defined)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** Every page path, for the sitemap. */
	paths(): string[] {
		return [
			...[...this.units.keys()].map((slug) => `/docs/units/${slug}`),
			...[...this.buildings.keys()].map((slug) => `/docs/buildings/${slug}`),
			...[...this.commanders.keys()].map((slug) => `/docs/commanders/${slug}`),
			...this.weaponList().map((ref) => `/docs/weapons/${ref.slug}`)
		];
	}
}

let loading: Promise<GameDocs> | null = null;

/** Lazily imports the data (about 800 KB of JSON), once per isolate. */
export function loadGameDocs(): Promise<GameDocs> {
	loading ??= Promise.all([
		import('../data/meta.json'),
		import('../data/units.json'),
		import('../data/buildings.json'),
		import('../data/commanders.json'),
		import('../data/upgrades.json'),
		import('../data/abilities.json'),
		import('../data/weapons.json')
	]).then(
		([meta, units, buildings, commanders, upgrades, abilities, weapons]) =>
			new GameDocs(meta.default as DocMeta, {
				units: units.default as DocUnit[],
				buildings: buildings.default as DocBuilding[],
				commanders: commanders.default as DocCommander[],
				upgrades: upgrades.default as DocUpgrade[],
				abilities: abilities.default as DocAbility[],
				weapons: weapons.default as DocWeapon[]
			})
	);
	return loading;
}
