import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { seedOrderBody } from '$lib/server/tournament-params';

/** Staff or the host close registration and seed everyone by 1v1 ELO. */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournaments.seed(id))
);

/** Staff or the host change the seeding: every participant id, top seed first. */
export const PUT = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(seedOrderBody, event.request).andThen(({ order }) =>
			event.locals.services.tournaments.setSeeds(id, order)
		)
	)
);
