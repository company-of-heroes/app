import { handle } from '$lib/server/http';

/** Steam ids of players streaming Company of Heroes right now. */
export const GET = handle(({ locals, setHeaders }) =>
	locals.services.streaming.liveSteamIds().map((steamIds) => {
		setHeaders({ 'cache-control': 'public, max-age=30' });
		return { steamIds };
	})
);
