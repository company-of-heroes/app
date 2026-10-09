import { handle, requireUser } from '$lib/server/http';

/** The signed-in player's open tournament matches and processed games they have not seen. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.tournamentGames.mine(user))
);
