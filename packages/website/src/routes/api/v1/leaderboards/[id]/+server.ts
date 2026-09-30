import { z } from 'zod';
import { handle, parse } from '$lib/server/http';

export const GET = handle(({ params, locals, setHeaders }) =>
	parse(z.coerce.number().int(), params.id)
		.asyncAndThen((id) => locals.services.leaderboard.get(id))
		.map((leaderboard) => {
			setHeaders({
				'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
			});
			return leaderboard;
		})
);
