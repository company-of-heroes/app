import { json } from '@sveltejs/kit';
import { handle } from '$lib/server/http';

/** Public supporters list. */
export const GET = handle((event) =>
	event.locals.services.subscriptions
		.list()
		.map((list) => json(list, { headers: { 'cache-control': 'public, max-age=300' } }))
);
