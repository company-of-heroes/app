import { handle, requireUser } from '$lib/server/http';

/** What the checkout overlay needs for the signed-in user. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.subscriptions.checkout(user.id))
);
