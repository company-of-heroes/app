import { z } from 'zod';
import { handle, parseQuery, requireUser } from '$lib/server/http';

const querySchema = z.object({
	profileIds: z
		.string()
		.transform((value) =>
			value
				.split(',')
				.map(Number)
				.filter((id) => Number.isInteger(id) && id > 0)
		)
		.pipe(z.array(z.number()).min(1).max(16)),
	me: z.coerce.number().int().positive().optional()
});

/** The signed-in user's record against each of `profileIds`; `me` is their profile in the lobby. */
export const GET = handle((event) =>
	requireUser(event)
		.andThen((user) => parseQuery(querySchema, event.url).map((query) => ({ user, ...query })))
		.asyncAndThen(({ user, profileIds, me }) =>
			event.locals.services.headToHead.forUser(user.id, me ?? null, profileIds)
		)
);
