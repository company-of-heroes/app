import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Steam returns here after login; continues on the site with a login code. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const target = await locals.services.auth.steamCallback(url.searchParams, url.origin);
	if (target.isErr()) {
		error(target.error.status, target.error.message);
	}

	redirect(302, target.value);
};
