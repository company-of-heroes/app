import { handle, requireUser } from '$lib/server/http';

/** Admins sign in as another user ({ token, record }). */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.auth.impersonate(user, event.params.userId ?? '')
	)
);
