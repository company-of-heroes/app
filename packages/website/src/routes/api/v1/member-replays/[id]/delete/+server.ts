import { handle, requireUser } from '$lib/server/http';

/** Soft delete (older clients use POST …/delete). */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.memberReplays.remove(event.params.id ?? '', user.id)
	)
);
