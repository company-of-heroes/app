import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host disqualify a player: they forfeit their open and later matches. */
export const DELETE = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		event.locals.services.tournaments.disqualify(id, event.params.participantId!)
	)
);
