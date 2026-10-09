import { isStaffUser } from '$lib/auth/user';
import { handle, parse, parseQuery, readRecordBody, requireStaff } from '$lib/server/http';
import { imagesFrom, tournamentInput, tournamentScope } from '$lib/server/tournament-params';

/** Tournaments by scope: `active` (running), `upcoming` (sign-up; drafts for staff) or `past`. */
export const GET = handle((event) =>
	parseQuery(tournamentScope, event.url).asyncAndThen(({ scope }) =>
		event.locals.services.tournaments.list(scope, isStaffUser(event.locals.user))
	)
);

/** Staff create a tournament (JSON, or multipart with `banner` / `logo`); it starts as a draft. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(tournamentInput, data).asyncAndThen((input) =>
				event.locals.services.tournaments.create(input, imagesFrom(data, files), staff.id)
			)
		)
	)
);
