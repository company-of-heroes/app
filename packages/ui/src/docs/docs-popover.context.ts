import type { DocRef } from '@company-of-heroes/game-data/types';
import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
import { Context } from 'runed';
import { InfoPopover, type InfoEntry } from '../statistics/info-popover.svelte';

/** One stats popover per wiki page; rows show it on hover, like the lists on /stats. */
const context = new Context<InfoPopover>('<docs-popover />');

export const createDocsPopover = () => context.set(new InfoPopover());
export const useDocsPopover = () => context.getOr(null);

/** The stats popover entry for a wiki ref: units, upgrades and commanders (doctrines) have one. */
export function popoverEntry(ref: DocRef): InfoEntry | null {
	if (ref.id === undefined || !ref.faction) {
		return null;
	}

	const raceId = FACTION_RACE_ID[ref.faction];
	if (ref.kind === 'commander') {
		return { kind: 'doctrine', raceId, doctrine: ref.id, name: ref.name };
	}

	if (ref.kind === 'unit' || ref.kind === 'upgrade') {
		return { kind: ref.kind, raceId, id: ref.id, name: ref.name };
	}

	return null;
}
