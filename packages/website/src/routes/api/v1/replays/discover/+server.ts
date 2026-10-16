import { handle } from '$lib/server/http';

/** Featured replays, theme rows and the newest shared replays for the Discover view. */
export const GET = handle(({ locals, setHeaders }) =>
	locals.services.replays.discover().map((discover) => {
		setHeaders({
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
		});
		return discover;
	})
);
