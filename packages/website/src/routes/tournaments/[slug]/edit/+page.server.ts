import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	// Staff, or the host who created it.
	const id = await unwrapAsync(locals.services.tournaments.managed(params.slug, locals.user));
	const detail = await unwrapAsync(locals.services.tournaments.get(id, true));
	return { tournament: detail.tournament };
};
