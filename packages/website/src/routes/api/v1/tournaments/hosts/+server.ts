import { handle, requireStaff } from '$lib/server/http';

/** Staff: everyone with the host role. */
export const GET = handle((event) =>
	requireStaff(event).asyncAndThen(() => event.locals.services.tournamentHosts.hosts())
);
