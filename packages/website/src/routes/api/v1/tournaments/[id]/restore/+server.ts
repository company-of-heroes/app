import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host bring a deleted tournament back. */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournaments.restore(id))
);
