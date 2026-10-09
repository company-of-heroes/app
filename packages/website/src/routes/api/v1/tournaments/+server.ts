import { handle, parse, parseQuery, readRecordBody, requireHost } from '$lib/server/http';
import { imagesFrom, tournamentInput, tournamentScope } from '$lib/server/tournament-params';

/** Tournaments by scope: `active` (running), `upcoming` (sign-up; drafts for whoever runs them) or `past`. */
export const GET = handle((event) =>
	parseQuery(tournamentScope, event.url).asyncAndThen(({ scope }) =>
		event.locals.services.tournaments.list(scope, event.locals.user ?? null)
	)
);

/** Staff and hosts create a tournament (JSON, or multipart with `banner` / `logo`); it starts as a draft. */
export const POST = handle((event) =>
	requireHost(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(tournamentInput, data).asyncAndThen((input) =>
				event.locals.services.tournaments.create(input, imagesFrom(data, files), user.id)
			)
		)
	)
);
