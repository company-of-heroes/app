import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { postBody } from '$lib/server/tournament-params';

/** Staff or the host edit an update (participants are not notified again). */
export const PATCH = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(postBody, event.request).andThen((input) =>
			event.locals.services.tournaments.updatePost(id, event.params.postId!, input)
		)
	)
);

export const DELETE = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		event.locals.services.tournaments.deletePost(id, event.params.postId!).map(() => ({ ok: true }))
	)
);
