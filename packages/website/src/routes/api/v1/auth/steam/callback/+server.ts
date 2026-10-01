import { error, redirect } from '@sveltejs/kit';
import { takeSteamLoginCookie } from '$lib/server/steam-login-cookie';
import type { RequestHandler } from './$types';

/** Steam returns here after login; continues on the site with a login code. */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const target = await locals.services.auth.steamCallback(
		url.searchParams,
		url.origin,
		takeSteamLoginCookie(cookies, url)
	);
	if (target.isErr()) {
		error(target.error.status, target.error.message);
	}

	redirect(302, target.value);
};
