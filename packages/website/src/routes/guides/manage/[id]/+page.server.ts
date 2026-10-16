import { error, redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	const guide = await unwrapAsync(locals.services.guides.get(params.id, locals.user));
	if (!guide.canEdit) {
		error(403, locals.t('You can only edit your own guides.'));
	}

	return { guide, categories: await unwrapAsync(locals.services.guides.tree()) };
};
