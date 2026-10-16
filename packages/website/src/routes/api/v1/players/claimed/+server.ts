import { z } from 'zod';
import { handle, parseQuery } from '$lib/server/http';

const query = z.object({
	steamIds: z
		.string()
		.transform((value) => value.split(',').filter(Boolean))
		.pipe(z.array(z.string().regex(/^7656119\d{10}$/, 'Invalid Steam id')).max(200))
});

/** Which of these Steam ids an account linked (leaderboard claim buttons in the desktop app). */
export const GET = handle(({ url, locals, setHeaders }) =>
	parseQuery(query, url).asyncAndThen(({ steamIds }) =>
		locals.services.users.claimedSteamIds(steamIds).map((claimed) => {
			setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=120' });
			return { steamIds: [...claimed] };
		})
	)
);
