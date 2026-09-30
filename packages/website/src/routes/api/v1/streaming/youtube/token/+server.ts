import { z } from 'zod';
import { handle, parseBody } from '$lib/server/http';

const bodySchema = z.object({
	refresh_token: z.string().trim().min(1).max(4096)
});

/** Desktop: refresh a YouTube access token (client secret stays on the website). */
export const POST = handle((event) =>
	parseBody(bodySchema, event.request).andThen((body) =>
		event.locals.services.youtubeOauth.refresh(body.refresh_token)
	)
);
