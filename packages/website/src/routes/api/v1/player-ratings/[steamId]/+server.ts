import { handle } from '$lib/server/http';

/** `?fill=1` from older clients is ignored: ratings are refilled by the lobby ingest. */
export const GET = handle(({ params, locals }) =>
	locals.services.ratings.get(params.steamId ?? '')
);
