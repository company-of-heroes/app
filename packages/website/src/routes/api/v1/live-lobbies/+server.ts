import { json } from '@sveltejs/kit';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { livePublishSchema } from '$lib/server/domain/lobby-writes';
import { LIVE_CACHE } from '$lib/server/services/live-lobbies';

/** Games being played right now. */
export const GET = handle((event) =>
	event.locals.services.liveLobbies
		.list()
		.map((items) => json({ items }, { headers: { 'cache-control': LIVE_CACHE } }))
);

/** The app's heartbeat while its player is in a lobby or game. */
export const PUT = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(livePublishSchema, event.request).andThen((input) =>
			event.locals.services.liveLobbies.publish(user.id, input, {
				expand: event.url.searchParams.get('expand') ?? undefined
			})
		)
	)
);

/** The game ended. */
export const DELETE = handle((event) =>
	requireUser(event)
		.asyncAndThen((user) => event.locals.services.liveLobbies.end(user.id))
		.map(() => new Response(null, { status: 204 }))
);
