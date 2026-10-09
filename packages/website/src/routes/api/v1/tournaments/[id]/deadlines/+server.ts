import { handle, parseBody, requireStaff } from '$lib/server/http';
import { roundDeadlinesBody } from '$lib/server/tournament-params';

/** Staff set the last moment to play each round. */
export const PUT = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(roundDeadlinesBody, event.request).andThen(({ rounds }) =>
			event.locals.services.tournaments.setRoundDeadlines(event.params.id!, rounds)
		)
	)
);
