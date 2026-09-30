import { z } from 'zod';
import { handle, parseQuery } from '$lib/server/http';

const querySchema = z.object({
	scope: z.enum(['user', 'community']).default('user'),
	profileId: z.coerce.number().int().positive()
});

/** `userId` from older clients is ignored: user scope is always the signed-in account. */
export const GET = handle(({ url, locals }) =>
	parseQuery(querySchema, url).asyncAndThen(({ scope, profileId }) =>
		locals.services.performance.get(scope, profileId, locals.user?.id ?? null)
	)
);
