import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals }) => ({
	weapons: await unwrapAsync(locals.services.docs.weapons())
});
