import { json } from '@sveltejs/kit';
import { handle } from '$lib/server/http';
import { LIVE_CACHE } from '$lib/server/services/live-lobbies';

export const GET = handle((event) =>
	event.locals.services.liveLobbies
		.get(event.params.id ?? '')
		.map((lobby) => json(lobby, { headers: { 'cache-control': LIVE_CACHE } }))
);
