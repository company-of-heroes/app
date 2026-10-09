import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { matchTimeBody } from '$lib/server/tournament-params';

/** Staff or the host set or clear the agreed time of a match. */
export const PUT = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(matchTimeBody, event.request).andThen(({ scheduledAt }) =>
			event.locals.services.tournamentSchedule.setTime(id, event.params.matchId!, scheduledAt)
		)
	)
);
