import { query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

/** Next pages of the `/players` search (infinite scroll). */
export const searchPlayers = query(
	z.object({
		q: z.string().trim().min(1).max(64),
		page: z.number().int().min(1).max(100)
	}),
	async ({ q, page }) => {
		const { locals } = getRequestEvent();
		return unwrapAsync(locals.services.players.searchPage(q, false, page));
	}
);
