import { handle, requireUser } from '$lib/server/http';

/** The Mollie checkout link for the signed-in user's first payment. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.subscriptions.checkout(user.id, event.url.origin)
	)
);
