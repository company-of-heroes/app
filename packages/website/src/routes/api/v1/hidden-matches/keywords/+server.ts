import { z } from 'zod';
import { handle, parseBody, requireStaff } from '$lib/server/http';

/** Hides every match whose title contains this word. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		parseBody(z.object({ word: z.string().max(100) }), event.request).andThen(({ word }) =>
			event.locals.services.hiddenMatches.addKeyword(word, staff.id)
		)
	)
);
