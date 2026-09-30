import { handle } from '$lib/server/http';

export const GET = handle(({ locals, setHeaders }) =>
	locals.services.memberReplays.maps().map((items) => {
		setHeaders({ 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' });
		return { items };
	})
);
