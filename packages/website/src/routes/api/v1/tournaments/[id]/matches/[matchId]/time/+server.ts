import { handle, parseBody, requireStaff } from '$lib/server/http';
import { matchTimeBody } from '$lib/server/tournament-params';

/** Staff set or clear the agreed time of a match. */
export const PUT = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(matchTimeBody, event.request).andThen(({ scheduledAt }) =>
			event.locals.services.tournaments
				.idOf(event.params.id!, true)
				.andThen((id) =>
					event.locals.services.tournamentSchedule.setTime(id, event.params.matchId!, scheduledAt)
				)
		)
	)
);
