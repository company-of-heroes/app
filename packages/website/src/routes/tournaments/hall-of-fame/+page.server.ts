import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals }) => ({
	hallOfFame: await unwrapAsync(locals.services.tournamentStats.hallOfFame())
});
