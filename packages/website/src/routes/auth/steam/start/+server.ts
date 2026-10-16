import { error, redirect } from '@sveltejs/kit';
import { okAsync } from 'neverthrow';
import type { Task } from '$lib/server/result';
import { setSteamLoginCookie } from '$lib/server/steam-login-cookie';
import type { RequestHandler } from './$types';

/**
 * Sends the browser to Steam's login (older links pass the site as `origin`). Claiming a
 * Steam account adds it to the signed-in user: `claim=1` on the site, or `link={code}` (a
 * handoff code) from the desktop app. Signed out, a claim is a regular Steam login.
 */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const code = url.searchParams.get('link');
	const claimant: Task<string | null> = code
		? locals.services.auth.userFromHandoff(code)
		: okAsync(url.searchParams.has('claim') ? (locals.user?.id ?? null) : null);
	const target = await claimant.andThen((link) =>
		locals.services.auth.steamStart(
			url.origin,
			url.searchParams.get('origin'),
			url.searchParams.get('redirect'),
			link
		)
	);
	if (target.isErr()) {
		error(target.error.status, target.error.message);
	}

	setSteamLoginCookie(cookies, url, target.value.nonce);
	redirect(302, target.value.url);
};
