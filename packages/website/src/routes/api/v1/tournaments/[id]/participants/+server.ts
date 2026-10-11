import { handle, parseBody } from '$lib/server/http';
import { requireManager } from '$lib/server/tournament-access';
import { addParticipantBody } from '$lib/server/tournament-params';

/** Staff or the host add a player by Steam id (until the tournament starts). */
export const POST = handle((event) =>
	requireManager(event).andThen(({ id }) =>
		parseBody(addParticipantBody, event.request).andThen(({ steamId }) =>
			event.locals.services.tournaments.addParticipant(id, steamId)
		)
	)
);
