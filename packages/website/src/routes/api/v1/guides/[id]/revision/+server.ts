import { handle, requireUser } from '$lib/server/http';

/** Drops the changes to a published guide that wait for review. */
export const DELETE = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.guides.discardRevision(event.params.id!, user)
	)
);
