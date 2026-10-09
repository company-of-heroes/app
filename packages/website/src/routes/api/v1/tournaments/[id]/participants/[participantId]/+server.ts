import { handle, requireStaff } from '$lib/server/http';

/** Staff disqualify a player: they forfeit their open and later matches. */
export const DELETE = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		event.locals.services.tournaments.disqualify(event.params.id!, event.params.participantId!)
	)
);
