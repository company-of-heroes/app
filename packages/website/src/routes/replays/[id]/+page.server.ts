import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Stream the match promise so client navigation is not blocked on the lookup. A full
 * page request also awaits it as `meta`, so crawlers and link previews get real tags
 * and an unknown replay answers with a real 404 instead of a loading shell; other
 * failures keep the in-page error state.
 */
export const load: PageServerLoad = async ({ locals, params, isDataRequest }) => {
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	const match = unwrapAsync(locals.services.replays.getAny(params.id, viewer));
	return {
		match,
		meta: isDataRequest
			? null
			: await match.catch((error: unknown) => {
					if (isHttpError(error) && error.status === 404) {
						throw error;
					}

					return null;
				})
	};
};
