import { error, redirect } from '@sveltejs/kit';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const match = await unwrapAsync(locals.services.replays().getMember(params.id));
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
