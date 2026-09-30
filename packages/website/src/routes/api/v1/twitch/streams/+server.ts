import { handle } from '$lib/server/http';

export const GET = handle(({ locals, setHeaders }) =>
	locals.services.twitch.listStreams().map((items) => {
		setHeaders({ 'cache-control': 'public, max-age=60' });
		return { items };
	})
);
