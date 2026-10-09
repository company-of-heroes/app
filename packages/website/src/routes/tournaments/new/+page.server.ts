import { error, redirect } from '@sveltejs/kit';
import { canHostTournaments, loginRedirectHref } from '$lib/auth/user';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	if (!canHostTournaments(locals.user)) {
		error(403, locals.t('Only staff and tournament hosts can do that.'));
	}

	return {};
};
