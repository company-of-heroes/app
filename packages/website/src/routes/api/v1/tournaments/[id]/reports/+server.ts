import { handle, requireStaff } from '$lib/server/http';

/** Staff: every problem report of the tournament, newest first. */
export const GET = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		event.locals.services.tournaments
			.idOf(event.params.id!, true)
			.andThen((id) => event.locals.services.tournamentReports.list(id))
	)
);
