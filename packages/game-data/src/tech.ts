import type { Faction } from './types';

/**
 * Tech order per faction (the game files do not link buildings to their prerequisites):
 * the HQ first, then each tier. British trucks are units that build like buildings.
 * Producers not listed here (bunkers, commander gliders) come after these.
 */
export const TECH_ORDER: Record<Faction, { slug: string; tier: string }[]> = {
	allies: [
		{ slug: 'us-hq', tier: 'HQ' },
		{ slug: 'barracks', tier: 'T1' },
		{ slug: 'support-weapons', tier: 'T2' },
		{ slug: 'motorpool', tier: 'T3' },
		{ slug: '2nd-motorpool', tier: 'T4' }
	],
	axis: [
		{ slug: 'wh-hq', tier: 'HQ' },
		{ slug: 'basic-support', tier: 'T1' },
		{ slug: 'platoon-support-building', tier: 'T2' },
		{ slug: 'company-support-building', tier: 'T3' },
		{ slug: 'battalion-support-building', tier: 'T4' }
	],
	allies_commonwealth: [
		{ slug: 'hq-squad', tier: 'HQ' },
		// The tiers players use for the trucks.
		{ slug: 'soldiers-hq-squad', tier: 'T2' },
		{ slug: 'armoured-hq-squad', tier: 'T3' }
	],
	axis_panzer_elite: [
		{ slug: 'pe-hq', tier: 'HQ' },
		{ slug: 'kampfgruppe-kompanie', tier: 'T1' },
		{ slug: 'logistik-kompanie', tier: 'T2' },
		{ slug: 'panzerjager-kommand', tier: 'T3' },
		{ slug: 'panzer-artillerie-kommand', tier: 'T3' }
	]
};
