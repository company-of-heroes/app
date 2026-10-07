import type {
	BuildingPage,
	CommanderPage,
	CommanderTier,
	DocAbility,
	DocBuilding,
	DocCommander,
	DocMeta,
	DocRef,
	DocWeaponRow,
	DocsOverview,
	DocUnit,
	DocUpgrade,
	DocUpgradeEntry,
	DocWeapon,
	Faction,
	UnitCallIn,
	UnitPage,
	WeaponPage
} from './types';
import { FACTIONS } from './factions';
import { TECH_ORDER } from './tech';

export type * from './types';
export { FACTIONS, FACTION_RACE_ID, isFaction } from './factions';

function bySlug<T extends { slug: string }>(items: T[]): Map<string, T> {
	return new Map(items.map((item) => [item.slug, item]));
}

function defined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

/** Lookups and reverse links over the generated documentation data. */
/** Joke units in the game files (the Eselschreck at every HQ); not real units, so not documented. */
const isJokeUnit = (slug: string) => slug.endsWith('-eselschreck-squad');

/**
 * Items the game never shows in a build menu have no icon of their own (doctrine gliders, the
 * call-in Crocodile, emplacement crews). Use the closest in-game icon: the doctrine pick, or the
 * emplacement the crew belongs to.
 */
const ICON_FALLBACKS: Record<string, string> = {
	vehicle_cmnw_commando_glider: 'commander_cmdr_cmnw_glider_borne_commandos',
	vehicle_cmnw_glider_hq: 'commander_cmdr_cmnw_glider_hq',
	vehicle_cmnw_tetrarch_glider: 'commander_cmdr_cmnw_tetrarch',
	vehicles_vehicle_cmnw_churchill_crocodile: 'commander_commonwealth_cmdr_cmnw_churchill_crocodile',
	unit_cmnw_mg: 'buildings_building_cmnw_mg_nest',
	unit_cmnw_mortar: 'buildings_building_cmnw_mortar'
};
const withIcon = <T extends { icon?: string }>(item: T): T =>
	item.icon && ICON_FALLBACKS[item.icon] ? { ...item, icon: ICON_FALLBACKS[item.icon] } : item;

/** Blueprints in the game files that no player can build: Panzer Elite has no bunker. */
const UNBUILDABLE_BUILDINGS = new Set(['pe-axis-bunker']);

/** Panzer Elite veterancy bought per rank (`vet-infantry-offensive-2`): its track and rank. */
function vetTrack(slug: string): { track: 'offensive' | 'defensive'; rank: number } | null {
	const match = /^vet-.*-(offensive|defensive)-(\d+)$/.exec(slug);
	return match ? { track: match[1] as 'offensive' | 'defensive', rank: Number(match[2]) } : null;
}

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
		this.units = bySlug(data.units.filter((unit) => !isJokeUnit(unit.slug)).map(withIcon));
		this.buildings = bySlug(
			data.buildings.filter((building) => !UNBUILDABLE_BUILDINGS.has(building.slug)).map(withIcon)
		);
		this.commanders = bySlug(data.commanders);
		this.upgrades = bySlug(data.upgrades);
		this.abilities = bySlug(data.abilities);
		// Weapons have no icon of their own in the game files: use the upgrade that adds the weapon,
		// else the first unit or building that carries it.
		const carrierIcon = (slug: string) =>
			[...this.upgrades.values()].find((upgrade) => this.addedWeapons(upgrade).includes(slug))
				?.icon ??
			[...this.units.values()].find((unit) =>
				unit.models?.some((model) => model.weapons?.includes(slug))
			)?.icon ??
			[...this.buildings.values()].find((building) => building.weapons?.includes(slug))?.icon;
		this.weapons = bySlug(
			data.weapons.map((weapon) =>
				weapon.icon ? weapon : { ...weapon, icon: carrierIcon(weapon.slug) }
			)
		);
	}

	unitRef(slug: string): DocRef | undefined {
		const unit = this.units.get(slug);
		return (
			unit && {
				kind: 'unit',
				slug,
				id: unit.id,
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
				id: building.id,
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
				id: commander.id,
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
			id: upgrade.id,
			faction: upgrade.factions[0],
			weapon: this.mainWeapon(upgrade),
			name: upgrade.name,
			icon: upgrade.icon,
			cost: upgrade.cost
		};
	}

	/** Weapons an upgrade adds: its own, or those its unlocked abilities fire (Mk2 grenades). */
	addedWeapons(upgrade: DocUpgrade): string[] {
		return [
			...new Set([
				...(upgrade.weapons ?? []),
				...(upgrade.unlocks?.abilities ?? []).flatMap(
					(slug) => this.abilities.get(slug)?.weapons ?? []
				)
			])
		];
	}

	/**
	 * The one weapon an upgrade is about, for linking its title: a weapon it adds directly, or the
	 * weapon of its only unlock (Mk2 Grenades → the grenade). Upgrades that unlock several things
	 * (the Wehrmacht phases) have none; their weapons are listed separately.
	 */
	mainWeapon(upgrade: DocUpgrade): string | undefined {
		if (upgrade.weapons?.length) {
			return upgrade.weapons[0];
		}

		const unlocks = upgrade.unlocks;
		const only =
			unlocks?.abilities?.length === 1 && !unlocks.units?.length && !unlocks.upgrades?.length
				? this.abilities.get(unlocks.abilities[0])
				: undefined;
		return only?.weapons?.length === 1 ? only.weapons[0] : undefined;
	}

	/** An upgrade for a page list, with links to the weapons it adds. */
	upgradeEntry(upgrade: DocUpgrade): DocUpgradeEntry {
		return {
			...upgrade,
			weapon: this.mainWeapon(upgrade),
			weaponRefs: this.addedWeapons(upgrade)
				.map((slug) => this.weaponRef(slug))
				.filter(defined)
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
				const ownUnits = units.filter((unit) => unit.faction === faction);
				// Variants share a name (rifleman-built sand bags, a grounded glider); list each name once.
				const seen = new Set<string>();
				const firstByName = (item: { name: string }) => !seen.has(item.name) && seen.add(item.name);
				// British trucks are units that build other units, like a building.
				const trucks = ownUnits.filter((unit) =>
					ownUnits.some((other) => other.producedBy?.includes(unit.slug))
				);
				const producers = [
					...own
						.filter((building) => building.produces?.length)
						.map((building) => ({
							ref: this.buildingRef(building.slug)!,
							produces: building.produces ?? [],
							research: building.research ?? []
						})),
					...trucks.map((truck) => ({
						ref: this.unitRef(truck.slug)!,
						produces: ownUnits
							.filter((unit) => unit.producedBy?.includes(truck.slug))
							.map((unit) => unit.slug),
						research: truck.upgrades ?? []
					}))
				];
				const order = TECH_ORDER[faction];
				const rank = (slug: string) => {
					const index = order.findIndex((entry) => entry.slug === slug);
					return index < 0 ? order.length : index;
				};
				const produced = new Set(producers.flatMap((producer) => producer.produces));
				const producerSlugs = new Set(producers.map((producer) => producer.ref.slug));
				return {
					faction,
					buildings: producers
						.sort((a, b) => rank(a.ref.slug) - rank(b.ref.slug))
						.filter((producer) => firstByName(producer.ref))
						.map((producer) => ({
							...producer.ref,
							tier: order.find((entry) => entry.slug === producer.ref.slug)?.tier,
							produces: producer.produces.map((slug) => this.unitRef(slug)).filter(defined),
							research: producer.research
								.map((slug) => this.upgrades.get(slug))
								.filter(defined)
								.map((upgrade) => this.upgradeRef(upgrade))
						})),
					structures: own
						.filter((building) => !building.produces?.length)
						.filter(firstByName)
						.map((building) => this.buildingRef(building.slug)!),
					otherUnits: ownUnits
						.filter((unit) => !produced.has(unit.slug) && !producerSlugs.has(unit.slug))
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

		const upgrades = (unit.upgrades ?? [])
			.map((item) => this.upgrades.get(item))
			.filter(defined)
			.map((upgrade) => this.upgradeEntry(upgrade));
		// Building research that applies to this unit: it names the unit, or unlocks one of its abilities.
		const research = [...this.upgrades.values()]
			.filter(
				(upgrade) =>
					upgrade.unlocks?.units?.includes(slug) ||
					upgrade.unlocks?.abilities?.some((ability) => unit.abilities?.includes(ability))
			)
			.map((upgrade) => ({
				...this.upgradeEntry(upgrade),
				researchedAt: [...this.buildings.values()]
					.filter((building) => building.research?.includes(upgrade.slug))
					.map((building) => this.buildingRef(building.slug))
					.filter(defined)
					// Building variants share a name (two Supply Yards); list each name once.
					.filter(
						(building, index, all) =>
							all.findIndex((other) => other.name === building.name) === index
					)
			}))
			.filter((upgrade) => upgrade.researchedAt.length);
		const vetUpgrades = (track: 'offensive' | 'defensive') =>
			upgrades
				.filter((upgrade) => vetTrack(upgrade.slug)?.track === track)
				.sort((a, b) => vetTrack(a.slug)!.rank - vetTrack(b.slug)!.rank);

		return {
			unit,
			weapons: [...weaponSlugs].map((item) => this.weapons.get(item)).filter(defined),
			abilities: (unit.abilities ?? []).map((item) => this.abilities.get(item)).filter(defined),
			upgrades: upgrades.filter((upgrade) => !vetTrack(upgrade.slug)),
			research,
			vetUpgrades: {
				offensive: vetUpgrades('offensive'),
				defensive: vetUpgrades('defensive')
			},
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
			research: (building.research ?? [])
				.map((item) => this.upgrades.get(item))
				.filter(defined)
				.map((upgrade) => this.upgradeEntry(upgrade)),
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
		// Upgrade weapons: which units can buy the upgrade, or which building researches it.
		const upgradeFor = [...this.upgrades.values()]
			.filter((upgrade) => this.addedWeapons(upgrade).includes(slug))
			.map((upgrade) => ({
				upgrade: this.upgradeRef(upgrade),
				units: [
					...[...this.units.values()]
						// The unit buys it, or building research names the unit (the BAR research → riflemen).
						.filter(
							(unit) =>
								unit.upgrades?.includes(upgrade.slug) || upgrade.unlocks?.units?.includes(unit.slug)
						)
						.map((unit) => this.unitRef(unit.slug)),
					...[...this.buildings.values()]
						.filter((building) => building.research?.includes(upgrade.slug))
						.map((building) => this.buildingRef(building.slug))
				].filter(defined)
			}))
			.filter((entry) => entry.units.length);
		return { weapon, usedBy, upgradeFor };
	}

	/** Weapons that a listed unit or building carries, or an upgrade adds, sorted by name. */
	weaponList(): DocWeaponRow[] {
		const carriers = [
			...[...this.units.values()].map((unit) => [
				...(unit.models ?? []).flatMap((model) => model.weapons ?? []),
				// Weapons the unit can get from its own upgrades or from building research count too.
				...(unit.upgrades ?? []).flatMap((slug) => {
					const upgrade = this.upgrades.get(slug);
					return upgrade ? this.addedWeapons(upgrade) : [];
				}),
				...[...this.upgrades.values()]
					.filter((upgrade) => upgrade.unlocks?.units?.includes(unit.slug))
					.flatMap((upgrade) => this.addedWeapons(upgrade))
			]),
			...[...this.buildings.values()].map((building) => building.weapons ?? [])
		];
		const usedBy = new Map<string, number>();
		for (const weapons of carriers) {
			for (const slug of new Set(weapons)) {
				usedBy.set(slug, (usedBy.get(slug) ?? 0) + 1);
			}
		}

		const used = new Set([
			...carriers.flat(),
			...[...this.upgrades.values()].flatMap((upgrade) => this.addedWeapons(upgrade))
		]);
		return [...used]
			.map((slug) => {
				const weapon = this.weapons.get(slug);
				return (
					weapon && {
						...this.weaponRef(slug)!,
						damage: weapon.damage,
						range: weapon.range,
						accuracy: weapon.accuracy,
						usedBy: usedBy.get(slug) ?? 0
					}
				);
			})
			.filter(defined)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** Every page path, for the sitemap. */
	paths(): string[] {
		return [
			...[...this.units.keys()].map((slug) => `/wiki/units/${slug}`),
			...[...this.buildings.keys()].map((slug) => `/wiki/buildings/${slug}`),
			...[...this.commanders.keys()].map((slug) => `/wiki/commanders/${slug}`),
			...this.weaponList().map((ref) => `/wiki/weapons/${ref.slug}`)
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
				// Generated JSON; the inferred types of units and weapons are too varied for a direct cast.
				units: units.default as unknown as DocUnit[],
				buildings: buildings.default as DocBuilding[],
				commanders: commanders.default as DocCommander[],
				upgrades: upgrades.default as DocUpgrade[],
				abilities: abilities.default as DocAbility[],
				weapons: weapons.default as unknown as DocWeapon[]
			})
	);
	return loading;
}
