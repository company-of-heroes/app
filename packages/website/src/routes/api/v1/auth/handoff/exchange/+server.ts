import { z } from 'zod';
import { handle, parseBody } from '$lib/server/http';

/** Trades a login code for a session ({ token, record }). */
export const POST = handle((event) =>
	parseBody(
		z.object({ code: z.string().trim().min(1, 'code is required.') }),
		event.request
	).andThen(({ code }) => event.locals.services.auth.exchangeHandoff(code))
);
