import { z } from 'zod';
import { handle, parseBody, parseQuery, requireUser } from '$lib/server/http';

const steamId = z
	.string()
	.trim()
	.regex(/^\d{17}$/)
	.nullish();

const progressQuery = z.object({ steamId });

const reportBody = z.object({
	steamId,
	deltaMs: z
		.number()
		.int()
		.min(0)
		.max(24 * 60 * 60 * 1000),
	twitchLogin: z.string().trim().max(64).nullish(),
	youtubeChannelId: z.string().trim().max(64).nullish()
});

/** Lifetime streaming time of one of the signed-in user's Steam accounts toward the Streamer label. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseQuery(progressQuery, event.url).asyncAndThen((query) =>
			event.locals.services.streaming.progress(user.id, query.steamId)
		)
	)
);

/** Desktop: adds time streamed live with Company of Heroes running. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(reportBody, event.request).andThen((body) =>
			event.locals.services.streaming.report(user.id, body)
		)
	)
);
