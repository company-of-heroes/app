import { handle, parseBody, requireUser } from '$lib/server/http';
import { reportBody } from '$lib/server/tournament-params';

/** A participant reports a problem with their match; staff get a notification. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(reportBody, event.request).andThen((report) =>
			event.locals.services.tournaments
				.report(user, event.params.id!, event.params.matchId!, report)
				.map(() => ({ ok: true }))
		)
	)
);
