import { handle, parseBody, requireStaff } from '$lib/server/http';
import { postBody } from '$lib/server/tournament-params';

/** Staff post an update on the Updates tab; every participant gets a notification. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((user) =>
		parseBody(postBody, event.request).andThen((input) =>
			event.locals.services.tournaments.createPost(event.params.id!, input, user.id)
		)
	)
);
