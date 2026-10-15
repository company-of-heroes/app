import { error, redirect } from '@sveltejs/kit';
import { canEditGuide, isEditorUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	if (!isEditorUser(locals.user)) {
		error(403, locals.t('Only editors and staff can do that.'));
	}

	const guide = await unwrapAsync(locals.services.guides.get(params.id, locals.user));
	if (!canEditGuide(locals.user, { author: guide.author.id })) {
		error(403, locals.t('You can only edit your own guides.'));
	}

	return { guide, categories: await unwrapAsync(locals.services.guides.tree()) };
};
