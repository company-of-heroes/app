import { getRequestEvent, query } from '$app/server';
import { unwrapAsync } from '$lib/errors/unwrap';

/** Steam ids of players streaming right now. */
export const getLiveStreamerIds = query(() =>
	unwrapAsync(getRequestEvent().locals.services.streaming.liveSteamIds())
);
