import { createTtlCache } from '@company-of-heroes/api';
import {
	invalidateHiddenKeywordCache,
	listHiddenKeywordWords,
	listHiddenSessionIds,
	titleMatchesHiddenKeyword
} from '$core/pocketbase/hidden-matches';

export type HiddenMatchFilters = { sessionIds: Set<number>; keywords: string[] };

const FILTERS_TTL_MS = 5 * 60_000;
const cache = createTtlCache<Promise<HiddenMatchFilters>>({ ttlMs: FILTERS_TTL_MS, max: 1 });

/** Staff-hidden session ids and title keywords, shared by every match list for 5 minutes. */
export function loadHiddenMatchFilters(): Promise<HiddenMatchFilters> {
	return cache.getOrLoad('filters', async () => {
		const [sessionIds, keywords] = await Promise.all([
			listHiddenSessionIds(),
			listHiddenKeywordWords()
		]);
		return { sessionIds, keywords };
	});
}

/** Drops the cached filters after staff hide or show a match or change a keyword. */
export function invalidateHiddenMatchFilters(): void {
	cache.invalidate();
	invalidateHiddenKeywordCache();
}

export function filterHiddenMatches<T extends { id: number; description?: string }>(
	matches: T[],
	filters: HiddenMatchFilters
): T[] {
	return matches.filter(
		(match) =>
			!filters.sessionIds.has(match.id) &&
			!titleMatchesHiddenKeyword(match.description, filters.keywords)
	);
}
