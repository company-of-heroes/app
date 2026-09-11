import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	return {
		user: locals.user,
		saved: url.searchParams.get('saved'),
		sent: url.searchParams.get('sent')
	};
};
