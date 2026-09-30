import { z } from 'zod';
import { handle, parseQuery, requireService } from '$lib/server/http';

const query = z.object({
	screeningLimit: z.coerce.number().int().min(0).max(100).catch(10),
	pollingLimit: z.coerce.number().int().min(0).max(100).catch(30)
});

/** Smurf worker: accounts due for screening or polling. */
export const GET = handle((event) =>
	requireService(event)
		.andThen(() => parseQuery(query, event.url))
		.asyncAndThen(({ screeningLimit, pollingLimit }) =>
			event.locals.services.smurf.workerBatch(screeningLimit, pollingLimit)
		)
);
