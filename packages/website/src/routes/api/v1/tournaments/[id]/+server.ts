import { isStaffUser } from '$lib/auth/user';
import { handle, parse, readRecordBody, requireStaff } from '$lib/server/http';
import { imagesFrom, tournamentUpdate } from '$lib/server/tournament-params';

/** A tournament (by id or slug) with its players, matches and round robin table. */
export const GET = handle((event) =>
	event.locals.services.tournaments.get(event.params.id!, isStaffUser(event.locals.user))
);

export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(tournamentUpdate, data).asyncAndThen((input) =>
				event.locals.services.tournaments.update(event.params.id!, input, imagesFrom(data, files))
			)
		)
	)
);
