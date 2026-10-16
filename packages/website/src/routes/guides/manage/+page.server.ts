import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	return { guides: await unwrapAsync(locals.services.guides.mine(locals.user)) };
};
