import { query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

const searchPlayersSchema = z.object({
	q: z.string().trim().max(100)
});

export const searchPlayers = query(searchPlayersSchema, async ({ q }) => {
	const { locals } = getRequestEvent();
	if (!q) {
		return [];
	}

	return unwrapAsync(locals.services.players().search(q));
});

const h2hBatchSchema = z.object({
	a: z.number().int().positive(),
	vs: z.array(z.number().int().positive()).max(16)
});

export const playerH2hBatch = query(h2hBatchSchema, async ({ a, vs }) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.playerCompare().h2hBatch(a, vs));
});
