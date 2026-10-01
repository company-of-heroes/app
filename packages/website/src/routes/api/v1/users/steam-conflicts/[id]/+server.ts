import { handle, requireStaff } from '$lib/server/http';

/** Dismisses a Steam conflict without merging. */
export const DELETE = handle((event) =>
	requireStaff(event)
		.asyncAndThen(() => event.locals.services.users.dismissConflict(event.params.id ?? ''))
		.map(() => new Response(null, { status: 204 }))
);
