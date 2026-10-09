import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host or the host: every problem report of the tournament, newest first. */
export const GET = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournamentReports.list(id))
);
