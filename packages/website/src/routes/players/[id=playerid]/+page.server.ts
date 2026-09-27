import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, params }) => {
	return {
		player: unwrapAsync(locals.services.players().get(params.id)).then(async (player) => {
			// Player page JSON can be HTTP-cached; customization must stay fresh after edits.
			const customization = await unwrapAsync(
				locals.services.players().getCustomization(player.steamId)
			);
			return { ...player, customization };
		})
	};
};
