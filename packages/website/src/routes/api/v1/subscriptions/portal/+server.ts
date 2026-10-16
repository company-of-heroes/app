import { handle, requireUser } from '$lib/server/http';

/** A Paddle customer portal link for the signed-in user. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.subscriptions.portal(user.id))
);
