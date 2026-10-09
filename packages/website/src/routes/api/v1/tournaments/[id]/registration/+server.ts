import { handle, parseBody, requireUser } from '$lib/server/http';
import { registrationBody } from '$lib/server/tournament-params';

/** Sign up with one of the account's linked Steam IDs (and accept the rules, when there are any). */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(registrationBody, event.request).andThen(({ steamId, acceptRules }) =>
			event.locals.services.tournaments.register(event.params.id!, user, steamId, acceptRules)
		)
	)
);

export const DELETE = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.tournaments.withdraw(event.params.id!, user.id)
	)
);
