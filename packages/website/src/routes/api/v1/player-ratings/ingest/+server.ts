import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const body = z.object({
	players: z
		.array(z.record(z.string(), z.unknown()))
		.min(1, 'players is required')
		.max(64, 'players cannot exceed 64')
});

/** Ratings the app read from its own Relic match history. */
export const POST = handle((event) =>
	requireUser(event)
		.asyncAndThen(() => parseBody(body, event.request))
		.andThen(({ players }) => event.locals.services.ratings.ingest(players))
		.map((players) => ({ players }))
);
