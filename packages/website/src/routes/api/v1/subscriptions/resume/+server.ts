import { handle, requireUser } from '$lib/server/http';

/** Undoes the signed-in user's cancel before the paid period ends. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.subscriptions.resume(user.id))
);
