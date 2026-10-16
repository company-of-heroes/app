import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Active supporters get their player card. Every other Steam ID goes to the player page, and
 * so does a supporter while their data cannot be loaded (e.g. Relic is down).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const card = await locals.services.subscriptions.card(params.steamId).match(
		(value) => value,
		(error) => {
			console.error('[card] could not load', params.steamId, error.message);
			return null;
		}
	);
	if (!card) {
		redirect(302, localizeHref(`/players/${params.steamId}`, locals.locale));
	}

	return { card };
};
