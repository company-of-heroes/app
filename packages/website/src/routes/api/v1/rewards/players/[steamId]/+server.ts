import { z } from 'zod';
import { handle, parse } from '$lib/server/http';

const steamIdSchema = z.string().regex(/^\d{17}$/, 'Enter a valid Steam ID64.');

/** A player's unlocked rewards; their owner also gets locked ones with progress. */
export const GET = handle((event) =>
	parse(steamIdSchema, event.params.steamId).asyncAndThen((steamId) =>
		event.locals.services.rewards.forPlayer(steamId, event.locals.user?.id ?? null)
	)
);
