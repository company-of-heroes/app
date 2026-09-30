import { z } from 'zod';
import { handle, parseBody } from '$lib/server/http';

const bodySchema = z.object({
	code: z.string().trim().min(1).max(4096)
});

/** Desktop: swap a short-lived handoff code for Google access/refresh tokens. */
export const POST = handle((event) =>
	parseBody(bodySchema, event.request).andThen((body) =>
		event.locals.services.youtubeOauth.redeem(body.code)
	)
);
