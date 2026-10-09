import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params }) => ({
	detail: await unwrapAsync(locals.services.tournaments.get(params.slug, isStaffUser(locals.user)))
});
