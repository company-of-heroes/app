import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { matchResultBody } from '$lib/server/tournament-params';

/** Staff or the host set a score, a walkover, or reset a match; returns the changed matches. */
export const PATCH = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(matchResultBody, event.request).andThen((result) =>
			event.locals.services.tournaments.setMatchResult(id, event.params.matchId!, result)
		)
	)
);
