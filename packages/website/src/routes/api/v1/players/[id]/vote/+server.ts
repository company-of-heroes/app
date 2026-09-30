import { handle, parseBody, requireUser } from '$lib/server/http';
import { voteBody } from '$lib/server/social-params';

/** Vote on a player by Steam id (0 removes the vote). */
export const PUT = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(voteBody, event.request)
			.andThen(({ value, toggle }) =>
				event.locals.services.playerSocial.vote(event.params.id ?? '', user.id, value, { toggle })
			)
			.map(({ vote, likeCount }) => ({ vote, likeCount }))
	)
);
