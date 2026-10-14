import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { handle, parseQuery, requireUser } from '$lib/server/http';

const querySchema = z.object({
	them: z.string().min(1),
	steamIds: z
		.string()
		.optional()
		.transform((value) => value?.split(',').filter(Boolean))
});

/** You against a player; `steamIds` limits which of your linked accounts count. */
export const GET = handle((event) =>
	requireUser(event)
		.andThen((user) => parseQuery(querySchema, event.url).map((query) => ({ user, ...query })))
		.asyncAndThen(({ user, them, steamIds }) =>
			event.locals.services.compare.get(user.id, them, steamIds)
		)
		.map((value) => json(value, { headers: { 'cache-control': 'private, no-store' } }))
);
