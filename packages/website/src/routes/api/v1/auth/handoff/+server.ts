import { handle, requireUser } from '$lib/server/http';

/** A short-lived code that signs the browser in as the app's user. */
export const POST = handle((event) =>
	requireUser(event)
		.asyncAndThen((user) => event.locals.services.auth.createHandoff(user.id))
		.map((code) => ({ code }))
);
