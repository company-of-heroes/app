import { handle, requireUser } from '$lib/server/http';

/** "Start tournament game": the player's next lobby with the opponent becomes the game. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.tournamentGames.arm(user, event.params.matchId!)
	)
);
