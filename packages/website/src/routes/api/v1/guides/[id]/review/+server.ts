import { handle, requireUser } from '$lib/server/http';

/** The author sends a draft, or changes to a published guide, to staff for review. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.guides.requestReview(event.params.id!, user)
	)
);
