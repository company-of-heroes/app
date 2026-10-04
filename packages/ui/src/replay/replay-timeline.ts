import type { ReplayAction, ReplayPlayer } from './types';

export type TimelineRowKey =
	| 'structures'
	| 'units'
	| 'defenses'
	| 'upgrades'
	| 'abilities'
	| 'doctrine';

export const TIMELINE_ROWS: ReadonlyArray<{ key: TimelineRowKey; label: string }> = [
	{ key: 'structures', label: 'Structures' },
	{ key: 'units', label: 'Units' },
	{ key: 'defenses', label: 'Defenses' },
	{ key: 'upgrades', label: 'Upgrades' },
	{ key: 'abilities', label: 'Abilities' },
	{ key: 'doctrine', label: 'Doctrine' }
];

/** BUILDING object IDs that are field defenses / emplacements rather than base structures. */
const DEFENSE_BUILDING_IDS: ReadonlySet<number> = new Set([
	// Allies
	1501, 1503, 1511, 1513, 1527, 1537, 1531, 1533, 1541, 1543, 1534, 1544, 1546, 1554, 1556, 1550,
	1551, 1601, 1611,
	// Commonwealth
	1619, 1629, 1620, 1630, 1623, 1633, 1625, 1635, 1631, 1641, 1638, 1648, 1643, 1644, 1646,
	// Wehrmacht
	1693, 1703, 1694, 1704, 1695, 1705, 1698, 1708, 1733, 1743, 1738, 1748, 1786, 1787, 1797,
	// Panzer Elite
	1839, 1840, 1850, 1851, 1863, 1874, 1864, 1875, 1867, 1879, 1897, 1909, 1902, 1914
]);

/**
 * UNIT_COMMAND object IDs left off the timeline: repairs, stance/camouflage toggles, facing,
 * range keeping and cancels. They repeat constantly and drown out real ability use.
 */
const NOISY_UNIT_COMMAND_IDS: ReadonlySet<number> = new Set([
	// Repair / recover / salvage
	3, 4, 94, 306, 312, 313, 314, 315, 316, 317, 319, 322, 332,
	// Toggles (camouflage, ambush, hull down, free-fire, sights, rapid fire, mine clearing, supplies)
	14, 56, 102, 103, 104, 106, 107, 138, 247, 297, 298, 299, 300, 335, 337, 444,
	// Hold fire / fire at will, facing, maintain command/support range
	510, 511, 192, 193, 196, 197, 198, 199, 200,
	// Cancel counter battery / overwatch
	178, 179, 255, 258, 260
]);

/** Timeline row for an action, or `null` for orders that are not build-order steps (move, capture, …). */
export function timelineRow(action: ReplayAction): TimelineRowKey | null {
	switch (action.command?.type) {
		case 'BUILDING':
			return DEFENSE_BUILDING_IDS.has(action.objectID ?? -1) ? 'defenses' : 'structures';
		case 'UNIT':
			return 'units';
		case 'UPGRADE':
			return 'upgrades';
		case 'UNIT_COMMAND':
			return NOISY_UNIT_COMMAND_IDS.has(action.objectID ?? -1) ? null : 'abilities';
		case 'SPECIAL_ABILITY':
			return 'abilities';
		case 'DOCTRINAL':
			return 'doctrine';
		case 'CANCEL_QUEUE':
			return cancelledRow(action);
		case 'CANCEL_CONSTRUCTION':
			return action.cancelled
				? timelineRow({
						...action,
						command: { type: 'BUILDING' },
						objectID: action.cancelled.objectID
					})
				: null;
		default:
			return null;
	}
}

/** Cancelled production / upgrades sit in the row of the order they removed; reinforcements are skipped. */
function cancelledRow(action: ReplayAction): TimelineRowKey | null {
	const order = action.cancelled;
	if (!order) {
		return null;
	}

	const type = order.command?.type;
	if (type === 'UNIT' || order.commandID === 0x3 || order.commandID === 0x52) {
		return 'units';
	}

	if (type === 'UPGRADE' || order.commandID === 0x34 || order.commandID === 0x14) {
		return 'upgrades';
	}

	return null;
}

export type DoctrineArt = {
	title: string;
	/** Action icon keys (see `host.resolve.actionIcon`). */
	medal: string;
	stripes: string;
	/** Large (256px) campaign badge used as the timeline background centrepiece. */
	badge: string;
};

const doctrine = (id: number, title: string, medal: string, stripes: string): DoctrineArt => ({
	title,
	medal: `commander_badges_ct_${medal}`,
	stripes: `commander_banners_ct_branchbanner_stripes_${stripes}`,
	badge: `timeline_bg_badge_${id}`
});

/** Keyed by doctrine id (same ids as `doctrineBannerFile`). */
const DOCTRINE_ART: Record<number, DoctrineArt> = {
	2: doctrine(2, 'U.S. Airborne Company', 'al_medal_airborne', 'allied_airborne'),
	9: doctrine(9, 'U.S. Armor Company', 'al_medal_armour', 'allied_armor'),
	17: doctrine(17, 'U.S. Infantry Company', 'al_medal_infantry', 'allied_infantry'),
	186: doctrine(186, 'Blitzkrieg Doctrine', 'ax_medal_blitz', 'axis_blitz'),
	194: doctrine(194, 'Defensive Doctrine', 'ax_medal_defense', 'axis_defense'),
	265: doctrine(265, 'Terror Doctrine', 'ax_medal_terror', 'axis_terror'),
	295: doctrine(295, 'Luftwaffe Tactics', 'pnze_medal_00', 'pnze_00'),
	302: doctrine(302, 'Scorched Earth Tactics', 'pnze_medal_01', 'pnze_01'),
	309: doctrine(309, 'Tank Destroyer Tactics', 'pnze_medal_02', 'pnze_02'),
	316: doctrine(316, 'Royal Artillery Support', 'cmnw_medal_00', 'cmnw_infantry'),
	323: doctrine(323, 'Royal Commandos Support', 'cmnw_medal_01', 'cmnw_airborne'),
	330: doctrine(330, 'Royal Engineers Support', 'cmnw_medal_02', 'cmnw_armor')
};

export function doctrineArt(
	player: Pick<ReplayPlayer, 'doctrine'> | undefined
): DoctrineArt | null {
	if (player?.doctrine == null) {
		return null;
	}

	return DOCTRINE_ART[player.doctrine] ?? null;
}

export type FactionArt = {
	/** Campaign map texture behind the rows. */
	map: string;
	/** Front-end character artwork for the faction. */
	character: string;
};

const FACTION_ART: Record<number, FactionArt> = {
	0: { map: 'timeline_bg_map_allies', character: 'timeline_bg_character_us' },
	1: { map: 'timeline_bg_map_axis', character: 'timeline_bg_character_wm' },
	2: { map: 'timeline_bg_map_allies', character: 'timeline_bg_character_cw' },
	3: { map: 'timeline_bg_map_axis', character: 'timeline_bg_character_pe' }
};

/** Background art for a race (0 = US, 1 = Wehrmacht, 2 = Commonwealth, 3 = Panzer Elite). */
export function factionArt(race: number | null | undefined): FactionArt {
	return FACTION_ART[race ?? 0] ?? FACTION_ART[0];
}

/** `m:ss` clock for a number of seconds (minutes are not wrapped into hours). */
export function formatTimelineClock(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const minutes = Math.floor(total / 60);
	const rest = total % 60;
	return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
}

const TICK_STEPS = [15, 30, 60, 2 * 60, 5 * 60, 10 * 60, 15 * 60, 30 * 60];

/**
 * Axis ticks in seconds, plus the match end. With `pxPerSecond` the step adapts to the zoom
 * level (labels at least ~72px apart); without it: every 10 min (5 min for short games).
 */
export function timelineTicks(durationSeconds: number, pxPerSecond?: number): number[] {
	const end = Math.max(1, Math.ceil(durationSeconds));
	const step =
		pxPerSecond && pxPerSecond > 0
			? (TICK_STEPS.find((value) => value * pxPerSecond >= 72) ?? TICK_STEPS[TICK_STEPS.length - 1])
			: end < 30 * 60
				? 5 * 60
				: 10 * 60;
	const ticks: number[] = [];
	for (let second = 0; second <= end; second += step) {
		ticks.push(second);
	}

	if (end - ticks[ticks.length - 1] > step * 0.3) {
		ticks.push(end);
	}

	return ticks;
}

export type VeterancyCategory = 'infantry' | 'support' | 'vehicles' | 'tanks';

/** Wehrmacht UNIT object IDs per Kampfkraft veterancy category. */
const WEHRMACHT_UNIT_CATEGORY: Record<number, VeterancyCategory> = {
	162: 'infantry', // Grenadiers
	182: 'infantry', // Knight's Cross Holders
	187: 'infantry', // Officer
	188: 'infantry', // Pioneers
	207: 'infantry', // Volksgrenadiers
	164: 'support', // MG42 Heavy Machine Gun
	186: 'support', // Gr. 34 8cm Mortar Team
	189: 'support', // Sniper
	214: 'support', // Nebelwerfer
	215: 'support', // Pak 38
	222: 'vehicles', // Schwimmwagen
	228: 'vehicles', // Geschutzwagen
	230: 'vehicles', // Sdkfz 251 Halftrack
	237: 'vehicles', // Motorcycle
	244: 'vehicles', // Sdkfz 234 Puma
	240: 'tanks', // Ostwind
	242: 'tanks', // Panther
	243: 'tanks', // Panzer IV
	251: 'tanks' // StuG IV
};

/** Kampfkraft research UPGRADE IDs → category and level (1 Veteran, 2 Crack, 3 Elite). */
const VETERANCY_RESEARCH: Record<number, { category: VeterancyCategory; level: number }> = {
	174: { category: 'infantry', level: 1 },
	175: { category: 'infantry', level: 2 },
	176: { category: 'infantry', level: 3 },
	177: { category: 'support', level: 1 },
	178: { category: 'support', level: 2 },
	179: { category: 'support', level: 3 },
	180: { category: 'tanks', level: 1 },
	181: { category: 'tanks', level: 2 },
	182: { category: 'tanks', level: 3 },
	183: { category: 'vehicles', level: 1 },
	184: { category: 'vehicles', level: 2 },
	185: { category: 'vehicles', level: 3 }
};

export const VETERANCY_NAMES = ['Veteran', 'Crack', 'Elite'] as const;

export type VeterancyStep = { level: number; timestamp: string };

/**
 * Wehrmacht veterancy per category, from Kampfkraft research orders (cancelled ones skipped).
 * Research applies to every unit of the category, so a unit shows the highest level its
 * category reached. Combat veterancy (US, Commonwealth, Panzer Elite) is not in replays.
 */
export function wehrmachtVeterancy(actions: ReplayAction[]) {
	const cancelled = new Set(
		actions
			.filter((action) => action.command?.type === 'CANCEL_QUEUE' && action.cancelled)
			.map((action) => `${action.cancelled!.tick}|${action.cancelled!.objectID}`)
	);
	const steps = new Map<VeterancyCategory, VeterancyStep[]>();
	for (const action of actions) {
		const research =
			action.command?.type === 'UPGRADE' ? VETERANCY_RESEARCH[action.objectID ?? -1] : undefined;
		if (!research || cancelled.has(`${action.tick}|${action.objectID}`)) {
			continue;
		}

		const list = steps.get(research.category) ?? [];
		if (!list.some((step) => step.level >= research.level)) {
			list.push({ level: research.level, timestamp: action.timestamp });
			steps.set(research.category, list);
		}
	}
	return steps;
}

/** Kampfkraft category of a Wehrmacht unit action, if it has one. */
export function wehrmachtUnitCategory(action: ReplayAction): VeterancyCategory | undefined {
	return action.command?.type === 'UNIT'
		? WEHRMACHT_UNIT_CATEGORY[action.objectID ?? -1]
		: undefined;
}
