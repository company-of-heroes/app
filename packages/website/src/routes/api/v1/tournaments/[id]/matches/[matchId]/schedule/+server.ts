import { handle, parseBody, requireUser } from '$lib/server/http';
import { scheduleBody } from '$lib/server/tournament-params';

/** A player proposes 1–3 times for their match; the opponent gets a notification. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(scheduleBody, event.request).andThen(({ times }) =>
			event.locals.services.tournaments
				.idOf(event.params.id!, true)
				.andThen((id) =>
					event.locals.services.tournamentSchedule.propose(user, id, event.params.matchId!, times)
				)
		)
	)
);
