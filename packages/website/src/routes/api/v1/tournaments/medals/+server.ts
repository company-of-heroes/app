import { handle } from '$lib/server/http';

/** The champion medal each tournament uses, so the picker can mark them as taken. */
export const GET = handle((event) => event.locals.services.tournaments.usedMedals());
