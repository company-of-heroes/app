import { handle, parseBody, requireStaff, requireUser } from '$lib/server/http';
import { hostRequestBody } from '$lib/server/tournament-params';

/** Staff: requests to become a host, open ones first. */
export const GET = handle((event) =>
	requireStaff(event).asyncAndThen(() => event.locals.services.tournamentHosts.list())
);

/** A signed-in user asks to host tournaments; staff get a notification. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(hostRequestBody, event.request).andThen((input) =>
			event.locals.services.tournamentHosts.request(user, input)
		)
	)
);
