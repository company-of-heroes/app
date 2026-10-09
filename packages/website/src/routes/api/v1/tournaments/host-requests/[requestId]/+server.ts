import { handle, parseBody, requireStaff } from '$lib/server/http';
import { hostDecisionBody } from '$lib/server/tournament-params';

/** Staff approve (the user gets the host role) or decline a request. */
export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		parseBody(hostDecisionBody, event.request).andThen((decision) =>
			event.locals.services.tournamentHosts.decide(staff, event.params.requestId!, decision)
		)
	)
);
