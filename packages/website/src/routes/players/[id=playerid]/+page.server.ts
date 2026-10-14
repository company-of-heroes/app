import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Stream the player promise so client navigation is not blocked on the Relic lookup. A
 * full page request also awaits it as `meta`, so crawlers and link previews get real tags
 * and an unknown player answers with a real 404 instead of a loading shell.
 */
export const load: PageServerLoad = async ({ locals, params, isDataRequest }) => {
	const player = unwrapAsync(locals.services.playerPage.get(params.id)).then(async (player) => {
		// The player page is cached briefly; customization must stay fresh after edits.
		// Rewards and trophies load with it, so they do not pop in after the page renders.
		const [customization, rewards, tournaments] = await Promise.all([
			unwrapAsync(locals.api.players.getCustomization(player.steamId)),
			locals.services.rewards.forPlayer(player.steamId, locals.user?.id ?? null).unwrapOr(null),
			locals.services.tournaments.wonBy(player.steamId).unwrapOr([])
		]);
		return { ...player, customization, rewards, tournaments };
	});
	return {
		player,
		meta: isDataRequest ? null : await player
	};
};
