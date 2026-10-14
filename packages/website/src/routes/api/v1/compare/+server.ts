import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { handle, parseQuery, requireUser } from '$lib/server/http';

const querySchema = z.object({ them: z.string().min(1) });

/** You against a player, per linked account (the page combines the ones you select). */
export const GET = handle((event) =>
	requireUser(event)
		.andThen((user) => parseQuery(querySchema, event.url).map((query) => ({ user, ...query })))
		.asyncAndThen(({ user, them }) => event.locals.services.compare.get(user.id, them))
		.map((value) => json(value, { headers: { 'cache-control': 'private, no-store' } }))
);
