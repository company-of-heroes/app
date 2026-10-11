import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { swapBody } from '$lib/server/tournament-params';

/** Staff or the host swap two players in the bracket (unplayed matches only). */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(swapBody, event.request).andThen(({ a, b }) =>
			event.locals.services.tournaments.swap(id, a, b)
		)
	)
);
