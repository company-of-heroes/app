import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';
import { err, ok } from 'neverthrow';
import { notFound } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/** Local development only: fake live lobbies for the home page and the app's widget (another origin). */
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, DELETE, OPTIONS'
};

function seeder(event: RequestEvent) {
	if (!dev) {
		return err(notFound('Not found'));
	}

	event.setHeaders(CORS);
	return ok(event.locals.services.devSeed);
}

export const OPTIONS = () =>
	new Response(null, { status: dev ? 204 : 404, headers: dev ? CORS : {} });
export const POST = handle((event) => seeder(event).asyncAndThen((devSeed) => devSeed.seed()));
export const DELETE = handle((event) => seeder(event).asyncAndThen((devSeed) => devSeed.clear()));
