import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { postBody } from '$lib/server/tournament-params';

/** Staff or the host post an update on the Updates tab; every participant gets a notification. */
export const POST = handle((event) =>
	requireManager(event).andThen(({ user, id }) =>
		parseBody(postBody, event.request).andThen((input) =>
			event.locals.services.tournaments.createPost(id, input, user.id)
		)
	)
);
