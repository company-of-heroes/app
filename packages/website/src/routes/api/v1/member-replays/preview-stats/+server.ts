import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const bodySchema = z.object({
	players: z.preprocess(
		(value) => (typeof value === 'string' ? JSON.parse(value) : value),
		z.array(z.record(z.string(), z.unknown())).max(16)
	),
	isRanked: z.union([z.boolean(), z.stringbool()]).catch(false),
	durationInSeconds: z.coerce.number().min(0).catch(0)
});

/** Ratings the upload form shows before a replay is saved. */
export const POST = handle((event) =>
	requireUser(event)
		.asyncAndThen(() => parseBody(bodySchema, event.request))
		.andThen(({ players, isRanked, durationInSeconds }) => {
			event.setHeaders({ 'cache-control': 'no-store' });
			return event.locals.services.memberReplays.previewStats(players, isRanked, durationInSeconds);
		})
);
