import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals }) => {
	const staff = isStaffUser(locals.user);
	const [active, upcoming, past] = await Promise.all([
		unwrapAsync(locals.services.tournaments.list('active', staff)),
		unwrapAsync(locals.services.tournaments.list('upcoming', staff)),
		unwrapAsync(locals.services.tournaments.list('past', staff))
	]);
	return { active, upcoming, past };
};
