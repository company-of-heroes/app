import { handle, parseBody, requireStaff } from '$lib/server/http';
import { seedOrderBody } from '$lib/server/tournament-params';

/** Staff close registration and seed everyone by 1v1 ELO. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen(() => event.locals.services.tournaments.seed(event.params.id!))
);

/** Staff change the seeding: every participant id, top seed first. */
export const PUT = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(seedOrderBody, event.request).andThen(({ order }) =>
			event.locals.services.tournaments.setSeeds(event.params.id!, order)
		)
	)
);
