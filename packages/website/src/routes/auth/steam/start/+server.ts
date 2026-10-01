import { error, redirect } from '@sveltejs/kit';
import { setSteamLoginCookie } from '$lib/server/steam-login-cookie';
import type { RequestHandler } from './$types';

/** Sends the browser to Steam's login (older links pass the site as `origin`). */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const target = await locals.services.auth.steamStart(
		url.origin,
		url.searchParams.get('origin'),
		url.searchParams.get('redirect')
	);
	if (target.isErr()) {
		error(target.error.status, target.error.message);
	}

	setSteamLoginCookie(cookies, url, target.value.nonce);
	redirect(302, target.value.url);
};
