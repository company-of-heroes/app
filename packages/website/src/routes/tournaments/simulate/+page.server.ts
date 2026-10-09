import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { SIM_RETURN_COOKIE } from '$lib/server/services/dev-tournament-sim';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Local development only: the tournament simulator. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!dev) {
		error(404, locals.t('Not found'));
	}

	if (!locals.user) {
		redirect(303, loginRedirectHref(`${url.pathname}${url.search}`, locals.locale));
	}

	const slug = url.searchParams.get('slug');
	const viewingAs = cookies.get(SIM_RETURN_COOKIE) ? locals.user : null;
	if (viewingAs) {
		// Acting as a bot: only the way back.
		return { viewingAs, slug, overview: null };
	}

	if (!isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return {
		viewingAs: null,
		slug,
		overview: await unwrapAsync(
			locals.services.devTournamentSim.overview(
				locals.user,
				slug && /^sim-\d+$/.test(slug) ? slug : null
			)
		)
	};
};
