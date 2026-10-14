import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	setHeaders({ 'cache-control': 'private, no-store' });
	return { compare: await unwrapAsync(locals.services.compare.get(locals.user.id, params.id)) };
};
