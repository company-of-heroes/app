import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { roundDeadlinesBody } from '$lib/server/tournament-params';

/** Staff or the host set the last moment to play each round. */
export const PUT = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(roundDeadlinesBody, event.request).andThen(({ rounds }) =>
			event.locals.services.tournaments.setRoundDeadlines(id, rounds)
		)
	)
);
