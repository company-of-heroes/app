import { handle, parseBody, requireStaff } from '$lib/server/http';
import { matchResultBody } from '$lib/server/tournament-params';

/** Staff set a score, a walkover, or reset a match; returns the changed matches. */
export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(matchResultBody, event.request).andThen((result) =>
			event.locals.services.tournaments.setMatchResult(
				event.params.id!,
				event.params.matchId!,
				result
			)
		)
	)
);
