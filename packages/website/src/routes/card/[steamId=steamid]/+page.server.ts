import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Active supporters get their player card; every other Steam ID goes to the player page. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const card = await unwrapAsync(locals.services.subscriptions.card(params.steamId));
	if (!card) {
		redirect(302, localizeHref(`/players/${params.steamId}`, locals.locale));
	}

	return { card };
};
