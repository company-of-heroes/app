import { handle, parseBody, requireUser } from '$lib/server/http';
import { claimBody } from '$lib/server/tournament-params';

/** The armed lobby started: it is the tournament game and stays hidden until the tournament ends. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(claimBody, event.request).andThen(({ sessionId, steamIds }) =>
			event.locals.services.tournamentGames
				.claim(user, event.params.matchId!, sessionId, steamIds)
				.map(() => ({ ok: true }))
		)
	)
);
