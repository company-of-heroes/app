import { error, redirect } from '@sveltejs/kit';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	const match = await unwrapAsync(
		locals.services.memberReplays.get(params.id, {
			id: locals.user.id,
			isStaff: isStaffUser(locals.user)
		})
	);
	if (match.kind !== 'member') {
		error(404, locals.t('That replay is not available.'));
	}

	if (match.uploadedBy?.id !== locals.user.id) {
		error(403, locals.t('You can only edit your own uploads.'));
	}

	if (match.visibility === 'deleted') {
		error(404, locals.t('That replay is not available.'));
	}

	return { match };
};
