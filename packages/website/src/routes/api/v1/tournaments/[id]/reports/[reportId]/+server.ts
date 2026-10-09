import { handle, parseBody, requireStaff } from '$lib/server/http';
import { reportUpdateBody } from '$lib/server/tournament-params';

/** Staff resolve or dismiss a report; the reporter gets the note. */
export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		parseBody(reportUpdateBody, event.request).andThen((update) =>
			event.locals.services.tournaments
				.idOf(event.params.id!, true)
				.andThen((id) =>
					event.locals.services.tournamentReports.update(staff, id, event.params.reportId!, update)
				)
		)
	)
);
