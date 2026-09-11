import { error, redirect } from '@sveltejs/kit';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const fromMatchId = url.searchParams.get('fromMatch')?.trim() || '';
	if (!fromMatchId) {
		return { fromMatch: null as null };
	}

	const match = await unwrapAsync(locals.services.replays().get(fromMatchId));
	if (match.memberReplayId) {
		redirect(303, `/replays/${match.memberReplayId}`);
	}

	if (!match.canPublish) {
		error(403, locals.t('You can only publish your own matches.'));
	}

	return { fromMatch: match };
};
