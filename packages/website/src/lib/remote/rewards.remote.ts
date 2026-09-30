import { getRequestEvent, query } from '$app/server';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

const steamIdSchema = z.string().regex(/^\d{17}$/);

/** A player's unlocked rewards; the owner also gets locked ones with progress. */
export const getPlayerRewards = query(steamIdSchema, (steamId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.rewards.forPlayer(steamId, locals.user?.id ?? null));
});
