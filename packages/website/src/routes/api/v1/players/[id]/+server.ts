import { handle } from '$lib/server/http';

export const GET = handle(({ params, locals, setHeaders }) =>
	locals.services.playerPage.get(params.id ?? '').map((player) => {
		setHeaders({ 'cache-control': 'public, max-age=30, stale-while-revalidate=60' });
		return player;
	})
);
