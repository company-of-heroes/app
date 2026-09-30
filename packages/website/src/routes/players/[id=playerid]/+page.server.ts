import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, params }) => {
	return {
		player: unwrapAsync(locals.services.playerPage.get(params.id)).then(async (player) => {
			// The player page is cached briefly; customization must stay fresh after edits.
			const customization = await unwrapAsync(locals.api.players.getCustomization(player.steamId));
			return { ...player, customization };
		})
	};
};
