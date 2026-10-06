import type { Faction } from './types';

export const FACTIONS: Faction[] = ['allies', 'axis', 'allies_commonwealth', 'axis_panzer_elite'];

/** Race ids as used by Relic/replays (`getRaceLabel`): 0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite. */
export const FACTION_RACE_ID: Record<Faction, number> = {
	allies: 0,
	axis: 1,
	allies_commonwealth: 2,
	axis_panzer_elite: 3
};

export function isFaction(value: string): value is Faction {
	return (FACTIONS as string[]).includes(value);
}
