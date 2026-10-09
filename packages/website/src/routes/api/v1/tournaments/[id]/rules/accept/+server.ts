import { handle, requireUser } from '$lib/server/http';

/** A participant accepts the tournament's current rules (again, after they changed). */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.tournaments.acceptRules(event.params.id!, user)
	)
);
