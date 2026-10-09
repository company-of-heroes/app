import type {
	BuildingPage,
	CommanderPage,
	CommanderTier,
	DocAbility,
	DocBuilding,
	DocCommander,
	DocMeta,
	DocRef,
	DocRequirements,
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

/** First item of each name (variants share one: two Supply Yards, two "Set Up" abilities). */
function firstOfName<T extends { name: string }>(item: T, index: number, all: T[]): boolean {
	return all.findIndex((other) => other.name === item.name) === index;
}

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

/** Panzer Elite veterancy bought per rank (`vet-infantry-offensive-2`): its track and rank. */
function vetTrack(slug: string): { track: 'offensive' | 'defensive'; rank: number } | null {
	const match = /^vet-.*-(offensive|defensive)-(\d+)$/.exec(slug);
	return match ? { track: match[1] as 'offensive' | 'defensive', rank: Number(match[2]) } : null;
}

/** Lookups and reverse links over the generated documentation data. */
export class GameDocs {
	readonly units: Map<string, DocUnit>;
	/** Units in lists; leaves out medal-reward skins of a call-in (Voss Tiger), which keep their page for replays. */
	readonly listedUnits: DocUnit[];
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
		this.units = bySlug(data.units.map(withIcon));
		this.buildings = bySlug(data.buildings.map(withIcon));
		this.commanders = bySlug(data.commanders);
		this.upgrades = bySlug(data.upgrades);
		this.abilities = bySlug(data.abilities);
		this.listedUnits = [...this.units.values()].filter(
			(unit) => !(unit.callIn && this.abilities.get(unit.callIn)?.reward)
		);
		// Weapons have no icon of their own in the game files: use the upgrade that adds the weapon,
		// else the first unit or building that carries it.
		const carrierIcon = (slug: string) =>
			[...this.upgrades.values()].find((upgrade) => this.addedWeapons(upgrade).includes(slug))
				?.icon ??
			[...this.units.values()].find((unit) => this.unitWeapons(unit).includes(slug))?.icon ??
			[...this.buildings.values()].find((building) => building.weapons?.includes(slug))?.icon;
		this.weapons = bySlug(
			data.weapons.map((weapon) =>
				weapon.icon ? weapon : { ...weapon, icon: carrierIcon(weapon.slug) }
			)
		);
	}

	/** Every weapon a unit carries: its models', built-in upgrades' and those mounted while loaded. */
	unitWeapons(unit: DocUnit): string[] {
		return [
			...new Set([
				...(unit.models ?? []).flatMap((model) => model.weapons ?? []),
				...(unit.weapons ?? []),
				...(unit.loadedWeapons ?? [])
			])
		];
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
				cost: unit.cost,
				reward: unit.reward
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

	/** `faction`: the page's faction, for upgrades several factions share (the Wehrmacht phases). */
	upgradeRef(upgrade: DocUpgrade, faction?: Faction): DocRef {
		return {
			kind: 'upgrade',
			slug: upgrade.slug,
			id: upgrade.id,
			faction: faction && upgrade.factions.includes(faction) ? faction : upgrade.factions[0],
			weapon: this.mainWeapon(upgrade),
			name: upgrade.name,
			icon: upgrade.icon,
			cost: upgrade.cost
		};
	}

	/** Upgrades and buildings an item needs first, as refs. */
	requirementRefs(
		item: DocRequirements,
		faction?: Faction
	): { requires: DocRef[]; requiresBuildings: DocRef[][] } {
		return {
			requires: (item.requires ?? [])
				.map((slug) => this.upgrades.get(slug))
				.filter(defined)
				.map((upgrade) => this.upgradeRef(upgrade, faction)),
			requiresBuildings: (item.requiresBuildings ?? [])
				.map((group) =>
					group
						.map((slug) => this.producerRef(slug))
						.filter(defined)
						.filter(firstOfName)
				)
				.filter((group) => group.length)
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

	/** An upgrade for a page list, with links to the weapons it adds and what it needs or changes. */
	upgradeEntry(upgrade: DocUpgrade, faction?: Faction): DocUpgradeEntry {
		const upgradeRefs = (slugs: string[] = []) =>
			slugs
				.map((slug) => this.upgrades.get(slug))
				.filter(defined)
				.map((item) => this.upgradeRef(item, faction));
		return {
			...upgrade,
			weapon: this.mainWeapon(upgrade),
			weaponRefs: this.addedWeapons(upgrade)
				.map((slug) => this.weaponRef(slug))
				.filter(defined),
			requiredRefs: upgradeRefs(upgrade.requires),
			excludedRefs: upgradeRefs(upgrade.excludes),
			appliesToRefs: (upgrade.appliesTo ?? [])
				.filter((slug) => this.listedUnits.some((unit) => unit.slug === slug))
				.map((slug) => this.unitRef(slug))
				.filter(defined)
		};
	}

	/** Research in the order it can be bought: an upgrade after the ones it needs (phase 2, 3, 4). */
	researchOrder(slugs: string[]): DocUpgrade[] {
		const upgrades = slugs.map((slug) => this.upgrades.get(slug)).filter(defined);
		const inList = new Set(upgrades.map((upgrade) => upgrade.slug));
		const depth = new Map<string, number>();
		const depthOf = (upgrade: DocUpgrade, seen = new Set<string>()): number => {
			const known = depth.get(upgrade.slug);
			if (known !== undefined) {
				return known;
			}

			seen.add(upgrade.slug);
			const before = (upgrade.requires ?? [])
				.filter((slug) => inList.has(slug) && !seen.has(slug))
				.map((slug) => depthOf(this.upgrades.get(slug)!, seen));
			const value = before.length ? Math.max(...before) + 1 : 0;
			depth.set(upgrade.slug, value);
			return value;
		};
		return upgrades
			.map((upgrade, index) => ({ upgrade, index, depth: depthOf(upgrade) }))
			.sort((a, b) => a.depth - b.depth || a.index - b.index)
			.map((entry) => entry.upgrade);
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

		// A medal-reward skin of a call-in (the Voss Tiger) is the same tier ability twice.
		const abilities = (upgrade.unlocks?.abilities ?? [])
			.map((slug) => this.abilities.get(slug))
			.filter(defined)
			.filter((ability) => !ability.reward);
		const unitSlugs = new Set([
			...(upgrade.unlocks?.units ?? []),
			...abilities.flatMap((ability) => ability.spawns ?? [])
		]);
		const buildingSlugs = new Set([
			...(upgrade.unlocks?.buildings ?? []),
			...abilities.flatMap((ability) => ability.buildings ?? [])
		]);
		return {
			upgrade,
			abilities,
			units: [...unitSlugs].map((slug) => this.unitRef(slug)).filter(defined),
			buildings: [...buildingSlugs]
				.map((slug) => this.buildingRef(slug))
				.filter(defined)
				.filter(firstOfName),
			weapons: (upgrade.weapons ?? []).map((slug) => this.weaponRef(slug)).filter(defined)
		};
	}

	/** Doctrine tiers that unlock an item: `match` returns the call-in ability (or the tier) or false. */
	private unlockedBy(match: (tier: CommanderTier) => DocRef | false): UnitCallIn[] {
		const out: UnitCallIn[] = [];
		for (const commander of this.commanders.values()) {
			for (const tierSlug of (commander.branches ?? []).flat()) {
				const tier = this.commanderTier(tierSlug);
				const found = tier ? match(tier) : false;
				if (!tier || !found) {
					continue;
				}

				out.push({
					commander: this.commanderRef(commander.slug)!,
					tier: this.upgradeRef(tier.upgrade, commander.faction),
					ability: found.kind === 'ability' ? found : undefined
				});
			}
		}

		return out;
	}

	overview(): DocsOverview {
		const units = this.listedUnits;
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
				// Buildings that produce units or research something (the Supply Yard, Kampfkraft Centre).
				const producers = [
					...own
						.filter((building) => building.produces?.length || building.research?.length)
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
							research: this.researchOrder(producer.research).map((upgrade) =>
								this.upgradeRef(upgrade, faction)
							)
						})),
					structures: own
						.filter((building) => !producerSlugs.has(building.slug))
						.filter(firstByName)
						.map((building) => this.buildingRef(building.slug)!),
					// Emplacement crews are their emplacement (listed under structures).
					otherUnits: ownUnits
						.filter(
							(unit) =>
								!produced.has(unit.slug) && !producerSlugs.has(unit.slug) && !unit.emplacement
						)
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

		const weaponSlugs = [
			...(unit.models ?? []).flatMap((model) => model.weapons ?? []),
			...(unit.weapons ?? [])
		];
		const calledInBy = this.unlockedBy((tier) => {
			if (!tier.units.some((ref) => ref.slug === slug)) {
				return false;
			}

			const ability = tier.abilities.find((item) => item.spawns?.includes(slug));
			return ability ? this.abilityRef(ability) : this.upgradeRef(tier.upgrade);
		});
		const upgrades = (unit.upgrades ?? [])
			.map((item) => this.upgrades.get(item))
			.filter(defined)
			.map((upgrade) => this.upgradeEntry(upgrade, unit.faction));
		// Building research that changes this unit (the BAR research → riflemen), or unlocks one of its abilities.
		const research = [...this.upgrades.values()]
			.filter(
				(upgrade) =>
					!unit.upgrades?.includes(upgrade.slug) &&
					(upgrade.appliesTo?.includes(slug) ||
						upgrade.unlocks?.abilities?.some((ability) => unit.abilities?.includes(ability)))
			)
			.map((upgrade) => ({
				...this.upgradeEntry(upgrade, unit.faction),
				researchedAt: [...this.buildings.values()]
					.filter((building) => building.research?.includes(upgrade.slug))
					.map((building) => this.buildingRef(building.slug))
					.filter(defined)
					// Building variants share a name (two Supply Yards); list each name once.
					.filter(firstOfName)
			}))
			.filter((upgrade) => upgrade.researchedAt.length);
		const vetUpgrades = (track: 'offensive' | 'defensive') =>
			upgrades
				.filter((upgrade) => vetTrack(upgrade.slug)?.track === track)
				.sort((a, b) => vetTrack(a.slug)!.rank - vetTrack(b.slug)!.rank);

		return {
			unit,
			weapons: [...new Set(weaponSlugs)].map((item) => this.weapons.get(item)).filter(defined),
			loadedWeapons: (unit.loadedWeapons ?? [])
				.map((item) => this.weapons.get(item))
				.filter(defined),
			// Abilities with the research they need (Throw Grenade → Mk2 Grenades); variants with the
			// same name and requirements (the trucks' Set Up) once, an improved version stays.
			abilities: (unit.abilities ?? [])
				.map((item) => this.abilities.get(item))
				.filter(defined)
				.filter(
					(ability, index, all) =>
						all.findIndex(
							(other) =>
								other.name === ability.name &&
								(other.requires ?? []).join() === (ability.requires ?? []).join()
						) === index
				)
				.map((ability) => ({
					...ability,
					requiredRefs: (ability.requires ?? [])
						.map((slug) => this.upgrades.get(slug))
						.filter(defined)
						.map((upgrade) => this.upgradeRef(upgrade, unit.faction))
				})),
			upgrades: upgrades.filter((upgrade) => !vetTrack(upgrade.slug)),
			research,
			vetUpgrades: {
				offensive: vetUpgrades('offensive'),
				defensive: vetUpgrades('defensive')
			},
			producedBy: (unit.producedBy ?? []).map((item) => this.producerRef(item)).filter(defined),
			calledInBy,
			builtBy: (unit.builtBy ?? [])
				.map((item) => this.unitRef(item))
				.filter(defined)
				.filter(firstOfName),
			emplacement: unit.emplacement ? this.buildingRef(unit.emplacement) : undefined,
			...this.requirementRefs(unit, unit.faction),
			replaces: (unit.replaces ?? []).map((item) => this.unitRef(item)).filter(defined),
			// Also the call-in skins left out of lists (the Tiger's Voss variant has its own page).
			replacedBy: [...this.units.values()]
				.filter((other) => other.replaces?.includes(slug))
				.map((other) => this.unitRef(other.slug))
				.filter(defined)
		};
	}

	buildingPage(slug: string): BuildingPage | undefined {
		const building = this.buildings.get(slug);
		if (!building) {
			return undefined;
		}

		const callIn = building.callIn ? this.abilities.get(building.callIn) : undefined;
		return {
			building,
			produces: (building.produces ?? []).map((item) => this.unitRef(item)).filter(defined),
			research: this.researchOrder(building.research ?? []).map((upgrade) =>
				this.upgradeEntry(upgrade, building.faction)
			),
			abilities: (building.abilities ?? [])
				.map((item) => this.abilities.get(item))
				.filter(defined)
				.filter(firstOfName),
			weapons: (building.weapons ?? []).map((item) => this.weapons.get(item)).filter(defined),
			builtBy: (building.builtBy ?? [])
				.map((item) => this.unitRef(item))
				.filter(defined)
				.filter(firstOfName),
			crew: (building.crew ?? []).map((item) => this.unitRef(item)).filter(defined),
			...this.requirementRefs(building, building.faction),
			unlockedBy: this.unlockedBy((tier) => {
				if (!tier.buildings.some((ref) => ref.slug === slug)) {
					return false;
				}

				const ability = callIn && tier.abilities.find((item) => item.slug === callIn.slug);
				return ability ? this.abilityRef(ability) : this.upgradeRef(tier.upgrade);
			})
		};
	}

	commanderPage(slug: string): CommanderPage | undefined {
		const commander = this.commanders.get(slug);
		if (!commander) {
			return undefined;
		}

		const branches = (commander.branches ?? []).map((tiers) =>
			tiers.map((tier) => this.commanderTier(tier)).filter(defined)
		);
		const inTiers = new Set(branches.flat().flatMap((tier) => tier.abilities.map((a) => a.slug)));
		const tierSlugs = new Set((commander.branches ?? []).flat());
		return {
			commander,
			// Abilities that need only the doctrine pick (and no tier).
			onPick: commander.unlock
				? [...this.abilities.values()]
						.filter(
							(ability) =>
								ability.requires?.includes(commander.unlock!) &&
								!ability.requires.some((required) => tierSlugs.has(required)) &&
								!inTiers.has(ability.slug) &&
								!ability.reward
						)
						.filter(firstOfName)
				: [],
			branches
		};
	}

	/** Units and buildings that have an ability, plus doctrine tiers that unlock it. */
	private abilityHolders(abilitySlug: string): DocRef[] {
		return [
			...this.listedUnits
				.filter((unit) => unit.abilities?.includes(abilitySlug))
				.map((unit) => this.unitRef(unit.slug)),
			...[...this.buildings.values()]
				.filter((building) => building.abilities?.includes(abilitySlug))
				.map((building) => this.buildingRef(building.slug)),
			...[...this.commanders.values()].flatMap((commander) =>
				(commander.branches ?? [])
					.flat()
					.filter((tier) => this.upgrades.get(tier)?.unlocks?.abilities?.includes(abilitySlug))
					.map(() => this.commanderRef(commander.slug))
			)
		]
			.filter(defined)
			.filter((ref, index, all) => all.findIndex((other) => other.slug === ref.slug) === index);
	}

	weaponPage(slug: string): WeaponPage | undefined {
		const weapon = this.weapons.get(slug);
		if (!weapon) {
			return undefined;
		}

		const usedBy = [
			...this.listedUnits
				.filter((unit) => this.unitWeapons(unit).includes(slug))
				.map((unit) => this.unitRef(unit.slug)),
			...[...this.buildings.values()]
				.filter((building) => building.weapons?.includes(slug))
				.map((building) => this.buildingRef(building.slug))
		].filter(defined);
		// Upgrade weapons: which units can buy the upgrade or get it from research, or which building
		// researches it. Upgrades nothing carries yet (a doctrine tier) are listed on their own.
		const upgradeFor = [...this.upgrades.values()]
			.filter((upgrade) => this.addedWeapons(upgrade).includes(slug))
			.map((upgrade) => {
				const units = [
					...this.listedUnits
						.filter(
							(unit) =>
								unit.upgrades?.includes(upgrade.slug) ||
								upgrade.appliesTo?.includes(unit.slug) ||
								upgrade.unlocks?.units?.includes(unit.slug)
						)
						.map((unit) => this.unitRef(unit.slug)),
					...[...this.buildings.values()]
						.filter((building) => building.research?.includes(upgrade.slug))
						.map((building) => this.buildingRef(building.slug))
				].filter(defined);
				return { upgrade: this.upgradeRef(upgrade, units[0]?.faction), units };
			});
		const firedBy = [...this.abilities.values()]
			.filter((ability) => ability.weapons?.includes(slug) && !ability.reward)
			.map((ability) => ({
				ability: this.abilityRef(ability),
				units: this.abilityHolders(ability.slug)
			}))
			.filter((entry) => entry.units.length)
			.filter(
				(entry, index, all) =>
					all.findIndex((other) => other.ability.name === entry.ability.name) === index
			);
		return { weapon, usedBy, upgradeFor, firedBy };
	}

	/** Weapons that a listed unit or building carries, an upgrade adds or an ability fires, sorted by name. */
	weaponList(): DocWeaponRow[] {
		const abilityWeapons = (slugs: string[] = []) =>
			slugs.flatMap((slug) => this.abilities.get(slug)?.weapons ?? []);
		const carriers = [
			...this.listedUnits.map((unit) => [
				...this.unitWeapons(unit),
				...abilityWeapons(unit.abilities),
				// Weapons the unit can get from its own upgrades or from building research count too.
				...(unit.upgrades ?? []).flatMap((slug) => {
					const upgrade = this.upgrades.get(slug);
					return upgrade ? this.addedWeapons(upgrade) : [];
				}),
				...[...this.upgrades.values()]
					.filter(
						(upgrade) =>
							upgrade.unlocks?.units?.includes(unit.slug) || upgrade.appliesTo?.includes(unit.slug)
					)
					.flatMap((upgrade) => this.addedWeapons(upgrade))
			]),
			...[...this.buildings.values()].map((building) => [
				...(building.weapons ?? []),
				...abilityWeapons(building.abilities)
			]),
			// Doctrine abilities (off-map strikes) count once per commander.
			...[...this.commanders.values()].map((commander) =>
				(commander.branches ?? [])
					.flat()
					.flatMap((tier) => abilityWeapons(this.upgrades.get(tier)?.unlocks?.abilities))
			)
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
			...this.listedUnits.map((unit) => `/wiki/units/${unit.slug}`),
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
				// Generated JSON; the inferred types are too varied for a direct cast.
				units: units.default as unknown as DocUnit[],
				buildings: buildings.default as unknown as DocBuilding[],
				commanders: commanders.default as DocCommander[],
				upgrades: upgrades.default as unknown as DocUpgrade[],
				abilities: abilities.default as unknown as DocAbility[],
				weapons: weapons.default as unknown as DocWeapon[]
			})
	);
	return loading;
}
