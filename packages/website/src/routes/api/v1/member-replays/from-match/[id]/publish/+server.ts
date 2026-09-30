import { handle, parseBody, requireUser } from '$lib/server/http';
import { publishFromMatchSchema } from '$lib/server/domain/member-replay-writes';

/** The match owner publishes its replay as a member replay. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(publishFromMatchSchema, event.request).andThen((input) =>
			event.locals.services.memberReplays.publishFromMatch(event.params.id ?? '', user.id, input)
		)
	)
);
