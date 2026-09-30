import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Google returns here; we exchange the code and bounce to the desktop loopback. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const result = await locals.services.youtubeOauth.callback(url.origin, url.searchParams);
	if (result.isErr()) {
		error(result.error.status, result.error.message);
	}

	redirect(302, result.value.redirectUri);
};
