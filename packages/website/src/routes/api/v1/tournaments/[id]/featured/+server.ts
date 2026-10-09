import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { featureBody } from '$lib/server/tournament-params';

/** Staff or the host put a match in the spotlight (null clears it). */
export const PUT = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(featureBody, event.request).andThen(({ matchId }) =>
			event.locals.services.tournaments.feature(id, matchId)
		)
	)
);
