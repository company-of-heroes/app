import { handle, parseBody, requireUser } from '$lib/server/http';
import { targetKind, voteBody } from '$lib/server/social-params';

export const PUT = handle((event) =>
	requireUser(event)
		.andThen((user) => targetKind(event.params.kind).map((kind) => ({ user, kind })))
		.asyncAndThen(({ user, kind }) =>
			parseBody(voteBody, event.request).andThen(({ value, toggle }) =>
				event.locals.services.social.voteComment(
					kind,
					event.params.commentId ?? '',
					user.id,
					value,
					{ toggle }
				)
			)
		)
		.map(({ vote, likeCount }) => ({ vote, likeCount }))
);
