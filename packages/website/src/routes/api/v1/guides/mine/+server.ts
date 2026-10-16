import { handle, requireUser } from '$lib/server/http';

/** Their own guides; staff: every guide. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.guides.mine(user))
);
