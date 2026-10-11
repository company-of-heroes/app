import { handle } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';

/** Staff or the host take a player out before the start (once running: disqualify). */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		event.locals.services.tournaments.removeParticipant(id, event.params.participantId!)
	)
);
