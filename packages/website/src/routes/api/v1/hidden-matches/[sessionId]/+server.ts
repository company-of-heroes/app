import { z } from 'zod';
import { handle, parse, requireStaff } from '$lib/server/http';

/** Shows a hidden match again. */
export const DELETE = handle((event) =>
	requireStaff(event)
		.andThen(() => parse(z.coerce.number().int().positive(), event.params.sessionId))
		.asyncAndThen((sessionId) => event.locals.services.hiddenMatches.unhide(sessionId))
		.map(() => new Response(null, { status: 204 }))
);
