import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	const [steamAccounts, supporter] = await Promise.all([
		unwrapAsync(locals.services.users.steamAccounts(locals.user.id)),
		unwrapAsync(locals.services.subscriptions.status(locals.user.id))
	]);
	return {
		user: locals.user,
		steamAccounts,
		supporter,
		saved: url.searchParams.get('saved'),
		sent: url.searchParams.get('sent'),
		/** A failed Steam account claim (already owned by another account). */
		error: url.searchParams.get('error')
	};
};
