import { handle, requireUser } from '$lib/server/http';

/** The signed-in user's latest request to host, or null. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.tournamentHosts.mine(user))
);
