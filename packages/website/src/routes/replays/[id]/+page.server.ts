import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Stream the match promise so client navigation is not blocked on the lookup. */
export const load: PageServerLoad = ({ locals, params }) => {
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	return {
		match: unwrapAsync(locals.services.replays.getAny(params.id, viewer))
	};
};
