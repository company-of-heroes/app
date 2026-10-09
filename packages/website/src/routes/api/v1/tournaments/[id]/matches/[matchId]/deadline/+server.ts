import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { matchDeadlineBody } from '$lib/server/tournament-params';

/** Staff or the host give one match its own deadline (null: the round's again). */
export const PUT = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(matchDeadlineBody, event.request).andThen(({ deadline }) =>
			event.locals.services.tournaments.setMatchDeadline(id, event.params.matchId!, deadline)
		)
	)
);
