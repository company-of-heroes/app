import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params }) => ({
	page: await unwrapAsync(locals.services.docs.weapon(params.slug))
});
