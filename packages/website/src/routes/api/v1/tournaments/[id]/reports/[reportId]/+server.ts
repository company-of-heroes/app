import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { reportUpdateBody } from '$lib/server/tournament-params';

/** Staff or the host resolve or dismiss a report; the reporter gets the note. */
export const PATCH = handle((event) =>
	requireManager(event).andThen(({ user: staff, id }) =>
		parseBody(reportUpdateBody, event.request).andThen((update) =>
			event.locals.services.tournamentReports.update(staff, id, event.params.reportId!, update)
		)
	)
);
