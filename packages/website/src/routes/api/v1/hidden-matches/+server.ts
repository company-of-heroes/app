import { z } from 'zod';
import { handle, parseBody, requireStaff } from '$lib/server/http';

/** Staff hide a match (by Relic session id) from everyone else. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		parseBody(z.object({ sessionId: z.number().int().positive() }), event.request).andThen(
			({ sessionId }) => event.locals.services.hiddenMatches.hide(sessionId, staff.id)
		)
	)
);
