import { handle, requireUser } from '$lib/server/http';

/** The opponent declines the proposed times. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.tournaments
			.idOf(event.params.id!, true)
			.andThen((id) =>
				event.locals.services.tournamentSchedule.decline(
					user,
					id,
					event.params.matchId!,
					event.params.proposalId!
				)
			)
	)
);
