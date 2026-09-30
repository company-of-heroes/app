import { error, redirect } from '@sveltejs/kit';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { localizeHref } from '@company-of-heroes/i18n';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	const fromMatchId = url.searchParams.get('fromMatch')?.trim() || '';
	if (!fromMatchId) {
		return { fromMatch: null as null };
	}

	const match = await unwrapAsync(
		locals.services.matches.get(fromMatchId, {
			id: locals.user.id,
			isStaff: isStaffUser(locals.user)
		})
	);
	if (match.memberReplayId) {
		redirect(303, localizeHref(`/replays/${match.memberReplayId}`, locals.locale));
	}

	if (!match.canPublish) {
		error(403, locals.t('You can only publish your own matches.'));
	}

	return { fromMatch: match };
};
