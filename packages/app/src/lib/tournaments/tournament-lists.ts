import { createTtlCache, type Tournament, type TournamentScope } from '@company-of-heroes/api';
import { api, unwrapApi } from '$core/api';

/** Last loaded list per scope, shared by the dashboard widget and /tournaments. */
const listCache = createTtlCache<Tournament[]>({ ttlMs: 120_000 });

/** The last loaded list of a scope, also when expired, to render at once while it refreshes. */
export function cachedTournaments(scope: TournamentScope): Tournament[] | undefined {
	return listCache.peek(scope);
}

/** Loads a scope from the API and keeps it for the next `cachedTournaments`. */
export async function loadTournaments(scope: TournamentScope): Promise<Tournament[]> {
	const tournaments = await unwrapApi(api.tournaments.list(scope));
	listCache.invalidate(scope);
	return listCache.getOrLoad(scope, () => tournaments);
}
