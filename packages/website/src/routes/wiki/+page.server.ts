import { isFaction } from '@company-of-heroes/game-data/factions';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	const param = url.searchParams.get('faction') ?? '';
	return {
		faction: isFaction(param) ? param : 'allies',
		overview: await unwrapAsync(locals.services.docs.overview())
	};
};
