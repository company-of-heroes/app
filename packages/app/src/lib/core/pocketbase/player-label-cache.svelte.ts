import {
	labelsBySteamId,
	listAssignmentsForSteamIds,
	sortUserLabels,
	type UserLabel
} from './user-labels';

let bySteam = $state.raw<Record<string, UserLabel[]>>({});
const fetched = new Set<string>();
const queued = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function labelsForSteamId(steamId: string | undefined | null): UserLabel[] {
	if (!steamId) {
		return [];
	}

	return bySteam[steamId] ?? [];
}

export function setLabelsForSteamId(steamId: string, labels: UserLabel[]) {
	if (!steamId) {
		return;
	}

	fetched.add(steamId);
	queued.delete(steamId);
	bySteam = { ...bySteam, [steamId]: sortUserLabels(labels) };
}

export function preloadPlayerLabels(steamIds: string[]) {
	const missing = [...new Set(steamIds.filter(Boolean))].filter(
		(id) => !fetched.has(id) && !queued.has(id)
	);
	if (missing.length === 0) {
		return;
	}

	for (const id of missing) {
		queued.add(id);
	}
	if (flushTimer) {
		return;
	}

	flushTimer = setTimeout(() => {
		flushTimer = null;
		const ids = [...queued];
		queued.clear();
		void fetchIds(ids);
	}, 0);
}

/** Loads the labels again, e.g. after the server granted one during this session. */
export function refreshPlayerLabels(steamIds: string[]) {
	for (const id of steamIds) {
		fetched.delete(id);
	}

	preloadPlayerLabels(steamIds);
}

async function fetchIds(ids: string[]) {
	try {
		const loaded = labelsBySteamId(await listAssignmentsForSteamIds(ids));
		const next = { ...bySteam };
		for (const id of ids) {
			fetched.add(id);
			next[id] = loaded[id] ?? [];
		}
		bySteam = next;
	} catch (error) {
		console.error('[PLAYER]: label preload failed:', error);
	}
}
