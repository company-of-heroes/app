import { handle, parseBody, requireUser } from '$lib/server/http';
import { acceptTimeBody } from '$lib/server/tournament-params';

/** The opponent accepts one of the proposed times. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(acceptTimeBody, event.request).andThen(({ time }) =>
			event.locals.services.tournaments
				.idOf(event.params.id!, true)
				.andThen((id) =>
					event.locals.services.tournamentSchedule.accept(
						user,
						id,
						event.params.matchId!,
						event.params.proposalId!,
						time
					)
				)
		)
	)
);
