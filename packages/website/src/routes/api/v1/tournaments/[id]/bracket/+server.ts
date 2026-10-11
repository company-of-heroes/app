import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host build the bracket during seeding, without starting. */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournaments.generateBracket(id))
);

/** Throw a generated bracket away again. */
export const DELETE = handle((event) =>
	requireManager(event).andThen(({ id }) => event.locals.services.tournaments.discardBracket(id))
);
