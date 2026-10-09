import { handle, parse } from '$lib/server/http';
import { steamIdParam } from '$lib/server/tournament-params';

/** Finished tournaments the player won, newest first (trophies on the player profile). */
export const GET = handle((event) =>
	parse(steamIdParam, { steamId: event.params.steamId }).asyncAndThen(({ steamId }) =>
		event.locals.services.tournaments.wonBy(steamId)
	)
);
