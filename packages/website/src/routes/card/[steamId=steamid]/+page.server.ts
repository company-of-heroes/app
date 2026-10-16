import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Active supporters get their player card. Every other Steam ID goes to the player page, and
 * so does a supporter while their data cannot be loaded (e.g. Relic is down). The owner also
 * gets the stored PNG's state, so their browser draws and uploads a new one when it is old.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const owned = await locals.services.subscriptions.ownedCard(params.steamId).match(
		(value) => value,
		(error) => {
			console.error('[card] could not load', params.steamId, error.message);
			return null;
		}
	);
	if (!owned) {
		redirect(302, localizeHref(`/players/${params.steamId}`, locals.locale));
	}

	const image =
		owned.userId === locals.user?.id
			? await locals.services.playerCards.state(owned.card).unwrapOr(null)
			: null;
	return { card: owned.card, image };
};
