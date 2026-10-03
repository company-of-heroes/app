/** Relic ranked ladders: 1v1–4v4 and arranged teams 2v2–4v4 (5–7). Basic Match is 0, skirmish 14. */
const RANKED_MATCH_TYPES = new Set([1, 2, 3, 4, 5, 6, 7]);

/** Relic's `matchtype_id` from a stored result, or null when there is no result. */
export function resultMatchTypeId(
	result: { matchtype_id?: unknown } | null | undefined
): number | null {
	const value = result?.matchtype_id;
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const id = Number(value);
	return Number.isInteger(id) ? id : null;
}

export function isRankedMatchType(id: number): boolean {
	return RANKED_MATCH_TYPES.has(id);
}

/** Ranked when Relic's result says so; the app-reported flag only counts while there is no result. */
export function isRankedMatch(
	isRanked: boolean | null | undefined,
	result: { matchtype_id?: unknown } | null | undefined
): boolean {
	const id = resultMatchTypeId(result);
	return id === null ? !!isRanked : isRankedMatchType(id);
}
