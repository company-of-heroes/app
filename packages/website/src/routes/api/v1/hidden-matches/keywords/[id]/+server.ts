import { z } from 'zod';
import { handle, parseBody, requireStaff } from '$lib/server/http';

export const PATCH = handle((event) =>
	requireStaff(event)
		.asyncAndThen(() => parseBody(z.object({ word: z.string().max(100) }), event.request))
		.andThen(({ word }) =>
			event.locals.services.hiddenMatches.updateKeyword(event.params.id ?? '', word)
		)
);

export const DELETE = handle((event) =>
	requireStaff(event)
		.asyncAndThen(() => event.locals.services.hiddenMatches.removeKeyword(event.params.id ?? ''))
		.map(() => new Response(null, { status: 204 }))
);
