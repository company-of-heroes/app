import type { BlueprintRef } from './replay-costs';

/** In-game name and description of an action's blueprint (see `action-info.ts`). */
export type ActionInfo = {
	name?: string;
	/** Help text shown in the game's tooltip. */
	help?: string;
	/** Short "Good vs. …" line. */
	extra?: string;
};

type InfoTable = Record<string, Record<number, ActionInfo>>;

let pending: Promise<InfoTable> | undefined;

/**
 * Loads the generated description table on first use. It is ~90 KB of text, so it lives in its
 * own chunk instead of the timeline bundle.
 */
export function loadActionInfo(): Promise<InfoTable> {
	pending ??= import('./action-info').then((module) => module.ACTION_INFO);
	return pending;
}

export function lookupActionInfo(
	table: InfoTable | undefined,
	target: BlueprintRef | null
): ActionInfo | null {
	return (target && table?.[target.list]?.[target.objectID]) || null;
}
