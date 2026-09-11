import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, params }) => {
	return {
		player: unwrapAsync(locals.services.players().get(params.id))
	};
};
