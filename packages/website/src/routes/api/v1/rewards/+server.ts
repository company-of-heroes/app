import { handle } from '$lib/server/http';

/** Every enabled reward, for the wiki; secret ones stay blank. */
export const GET = handle((event) => event.locals.services.rewards.catalogView());
