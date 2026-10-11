import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

const STEAM_ID = /^\d{17}$/;

/**
 * The reward catalog; `?player=` adds what that player unlocked (and the owner's progress).
 * Signed-in users see their own account by default; an empty `?player=` shows the plain catalog.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const steamId = url.searchParams.get('player') ?? locals.user?.steamIds?.[0] ?? '';
	const [rewards, player] = await Promise.all([
		unwrapAsync(locals.services.rewards.catalogView()),
		STEAM_ID.test(steamId)
			? Promise.all([
					unwrapAsync(locals.services.playerPage.get(steamId)),
					unwrapAsync(locals.services.rewards.forPlayer(steamId, locals.user?.id ?? null))
				])
					.then(([page, playerRewards]) => ({
						steamId,
						name: page.alias,
						rewards: playerRewards
					}))
					.catch(() => null)
			: null
	]);
	return { rewards, player };
};
