import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const reportBody = z.object({
	deltaMs: z
		.number()
		.int()
		.min(0)
		.max(24 * 60 * 60 * 1000),
	twitchLogin: z.string().trim().max(64).nullish(),
	youtubeChannelId: z.string().trim().max(64).nullish()
});

/** The signed-in user's lifetime streaming time toward the Streamer label. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.streaming.progress(user.id))
);

/** Desktop: adds time streamed live with Company of Heroes running. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(reportBody, event.request).andThen((body) =>
			event.locals.services.streaming.report(user.id, body)
		)
	)
);
