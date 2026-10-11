import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import { isPlayerId } from '$lib/utils/player/steam-id';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (isPlayerId(query)) {
		redirect(302, localizeHref(`/players/${query}`, locals.locale));
	}

	if (!query) {
		return { query: '', page: null, error: null };
	}

	return locals.services.players.searchPage(query, false).match(
		(page) => ({ query, page, error: null }),
		(cause) => ({ query, page: null, error: cause.message || 'Failed to search for player' })
	);
};
