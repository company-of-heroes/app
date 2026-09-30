import { handle } from '$lib/server/http';

export const GET = handle(({ url, locals, setHeaders }) =>
	locals.services.players
		.search(url.searchParams.get('q') ?? '', url.searchParams.get('requireMatches') === '1')
		.map((items) => {
			setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60' });
			return { items };
		})
);
