import { handle, requireUser } from '$lib/server/http';

/** Stops the signed-in user's monthly payments; the medal stays until the paid period ends. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.subscriptions.cancel(user.id))
);
