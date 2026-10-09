import { handle, parseBody, requireStaff } from '$lib/server/http';
import { postBody } from '$lib/server/tournament-params';

/** Staff edit an update (participants are not notified again). */
export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(postBody, event.request).andThen((input) =>
			event.locals.services.tournaments.updatePost(event.params.id!, event.params.postId!, input)
		)
	)
);

export const DELETE = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		event.locals.services.tournaments
			.deletePost(event.params.id!, event.params.postId!)
			.map(() => ({ ok: true }))
	)
);
