import { handle, parseBody, requireUser } from '$lib/server/http';
import { seenBody } from '$lib/server/tournament-params';

/** The popups of these games, tournament starts and updates were shown. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(seenBody, event.request).andThen((seen) =>
			event.locals.services.tournamentGames.markSeen(user, seen).map(() => ({ ok: true }))
		)
	)
);
