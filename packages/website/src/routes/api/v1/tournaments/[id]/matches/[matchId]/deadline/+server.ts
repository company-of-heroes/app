import { handle, parseBody, requireStaff } from '$lib/server/http';
import { matchDeadlineBody } from '$lib/server/tournament-params';

/** Staff give one match its own deadline (null: the round's again). */
export const PUT = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(matchDeadlineBody, event.request).andThen(({ deadline }) =>
			event.locals.services.tournaments.setMatchDeadline(
				event.params.id!,
				event.params.matchId!,
				deadline
			)
		)
	)
);
