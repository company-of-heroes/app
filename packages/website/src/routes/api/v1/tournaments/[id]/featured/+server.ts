import { handle, parseBody, requireStaff } from '$lib/server/http';
import { featureBody } from '$lib/server/tournament-params';

/** Staff put a match in the spotlight (null clears it). */
export const PUT = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(featureBody, event.request).andThen(({ matchId }) =>
			event.locals.services.tournaments.feature(event.params.id!, matchId)
		)
	)
);
