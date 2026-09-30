import { handle, parseBody, requireUser } from '$lib/server/http';
import { targetKind, voteBody } from '$lib/server/social-params';

/** Sets the signed-in user's vote on a match or replay (0 removes it). */
export const PUT = handle((event) =>
	requireUser(event)
		.andThen((user) => targetKind(event.params.kind).map((kind) => ({ user, kind })))
		.asyncAndThen(({ user, kind }) =>
			parseBody(voteBody, event.request).andThen(({ value, toggle }) =>
				event.locals.services.social.vote({ kind, id: event.params.id ?? '' }, user.id, value, {
					toggle
				})
			)
		)
		.map(({ vote, likeCount }) => ({ vote, likeCount }))
);
