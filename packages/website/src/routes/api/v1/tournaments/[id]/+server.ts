import { handle, parse, readRecordBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { imagesFrom, tournamentUpdate } from '$lib/server/tournament-params';

/** A tournament (by id or slug) with its players, matches and round robin table. */
export const GET = handle((event) =>
	event.locals.services.tournaments.get(event.params.id!, event.locals.user ?? null)
);

export const PATCH = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(tournamentUpdate, data).asyncAndThen((input) =>
				event.locals.services.tournaments.update(id, input, imagesFrom(data, files))
			)
		)
	)
);
