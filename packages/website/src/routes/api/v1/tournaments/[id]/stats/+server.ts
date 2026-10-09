import { isStaffUser } from '$lib/auth/user';
import { handle } from '$lib/server/http';

/** Numbers of a finished tournament (by id or slug). */
export const GET = handle((event) =>
	event.locals.services.tournamentStats.stats(event.params.id!, isStaffUser(event.locals.user))
);
