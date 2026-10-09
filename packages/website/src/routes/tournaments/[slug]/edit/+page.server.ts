import { error, redirect } from '@sveltejs/kit';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	if (!isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	const detail = await unwrapAsync(locals.services.tournaments.get(params.slug, true));
	return { tournament: detail.tournament };
};
