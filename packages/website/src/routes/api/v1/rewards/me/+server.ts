import { handle, requireUser } from '$lib/server/http';

/** The signed-in user's rewards with progress. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.rewards.forUser(user.id))
);
