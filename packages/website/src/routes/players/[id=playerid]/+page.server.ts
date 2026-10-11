import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, params }) => {
	return {
		player: unwrapAsync(locals.services.playerPage.get(params.id)).then(async (player) => {
			// The player page is cached briefly; customization must stay fresh after edits.
			// Rewards and trophies load with it, so they do not pop in after the page renders.
			const [customization, rewards, tournaments] = await Promise.all([
				unwrapAsync(locals.api.players.getCustomization(player.steamId)),
				locals.services.rewards.forPlayer(player.steamId, locals.user?.id ?? null).unwrapOr(null),
				locals.services.tournaments.wonBy(player.steamId).unwrapOr([])
			]);
			return { ...player, customization, rewards, tournaments };
		})
	};
};
