import { handle } from '$lib/server/http';

export const GET = handle(({ params, locals }) => locals.services.smurf.get(params.steamId ?? ''));
