import { handle, requireStaff } from '$lib/server/http';

/** Staff build the bracket from the seeding and start the tournament. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen(() => event.locals.services.tournaments.start(event.params.id!))
);
