import { z } from 'zod';
import { handle, parse, requireService } from '$lib/server/http';

/** Smurf worker: who the suspect plays with, and likely main accounts. */
export const GET = handle((event) =>
	requireService(event)
		.andThen(() =>
			parse(z.coerce.number().int().positive('profileId is required'), event.params.profileId)
		)
		.asyncAndThen((profileId) => event.locals.services.smurf.coplay(profileId))
);
