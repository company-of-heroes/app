import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host build the bracket from the seeding and start the tournament. */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournaments.start(id))
);
