import { handle, requireEditor } from '$lib/server/http';

/** Editors: their guides; staff: every guide. */
export const GET = handle((event) =>
	requireEditor(event).asyncAndThen((user) => event.locals.services.guides.mine(user))
);
