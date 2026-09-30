import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const body = z.object({
	profileIds: z
		.array(z.coerce.number().int())
		.min(1, 'profileIds is required')
		.max(40, 'profileIds cannot exceed 40')
});

/** Refreshes these players' ratings from Relic (leaderboard pages ask for their visible rows). */
export const POST = handle((event) =>
	requireUser(event)
		.asyncAndThen(() => parseBody(body, event.request))
		.andThen(({ profileIds }) => event.locals.services.ratingHarvest.harvest(profileIds))
);
