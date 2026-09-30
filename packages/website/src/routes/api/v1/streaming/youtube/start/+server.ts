import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Desktop opens this in the system browser; we bounce to Google consent. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const target = await locals.services.youtubeOauth.start(
		url.origin,
		url.searchParams.get('redirect_uri') ?? '',
		url.searchParams.get('state') ?? ''
	);
	if (target.isErr()) {
		error(target.error.status, target.error.message);
	}

	redirect(302, target.value);
};
