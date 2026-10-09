import type { Faction } from './types';

/**
 * Tech order per faction: the HQ first, then each tier. A tier is how many buildings (or Wehrmacht
 * battle phases) come before it in the game files' prerequisites (`requiresBuildings` / `requires`).
 * British trucks are units that build like buildings. Producers not listed here (bunkers, commander
 * gliders) come after these.
 */
export const TECH_ORDER: Record<Faction, { slug: string; tier: string }[]> = {
	allies: [
		{ slug: 'us-hq', tier: 'HQ' },
		// Neither needs another building.
		{ slug: 'barracks', tier: 'T1' },
		{ slug: 'support-weapons', tier: 'T1' },
		// Needs the Barracks or the Weapons Support Center.
		{ slug: 'us-quarter-master', tier: 'T2' },
		// Both need the Supply Yard.
		{ slug: 'motorpool', tier: 'T3' },
		{ slug: '2nd-motorpool', tier: 'T3' }
	],
	axis: [
		{ slug: 'wh-hq', tier: 'HQ' },
		{ slug: 'basic-support', tier: 'T1' },
		// Needs Wehrmacht Quarters.
		{ slug: 'wh-quarter-master', tier: 'T2' },
		// Battle phases 2, 3 and 4.
		{ slug: 'platoon-support-building', tier: 'T2' },
		{ slug: 'company-support-building', tier: 'T3' },
		{ slug: 'battalion-support-building', tier: 'T4' }
	],
	allies_commonwealth: [
		{ slug: 'hq-squad', tier: 'HQ' },
		// Need the Lieutenant and the Captain.
		{ slug: 'soldiers-hq-squad', tier: 'T2' },
		{ slug: 'armoured-hq-squad', tier: 'T3' }
	],
	axis_panzer_elite: [
		{ slug: 'pe-hq', tier: 'HQ' },
		// Neither needs another building.
		{ slug: 'kampfgruppe-kompanie', tier: 'T1' },
		{ slug: 'logistik-kompanie', tier: 'T1' },
		// Each needs the Kampfgruppe or the Logistik Kompanie.
		{ slug: 'panzerjager-kommand', tier: 'T2' },
		{ slug: 'panzer-artillerie-kommand', tier: 'T2' }
	]
};
