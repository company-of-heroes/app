import { error, redirect } from '@sveltejs/kit';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	if (!isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return {};
};
