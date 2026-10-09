import { handle } from '$lib/server/http';

/** Champions and podiums of every finished tournament. */
export const GET = handle((event) => event.locals.services.tournamentStats.hallOfFame());
