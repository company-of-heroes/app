import { handle, requireUser } from '$lib/server/http';

/** Counts a signed-in user's replay download once. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.social.recordDownload(event.params.id ?? '', user.id)
	)
);
