import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Stream the match promise so client navigation is not blocked on the API round-trip. */
export const load: PageServerLoad = ({ locals, params }) => {
	return {
		match: unwrapAsync(locals.services.replays().getAny(params.id))
	};
};
