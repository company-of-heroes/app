import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals }) => {
	const viewer = locals.user ?? null;
	const [active, upcoming, past] = await Promise.all([
		unwrapAsync(locals.services.tournaments.list('active', viewer)),
		unwrapAsync(locals.services.tournaments.list('upcoming', viewer)),
		unwrapAsync(locals.services.tournaments.list('past', viewer))
	]);
	return { active, upcoming, past };
};
