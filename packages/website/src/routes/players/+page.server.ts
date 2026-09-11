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
		return { query: '', results: [], error: null };
	}

	const result = await locals.services.players().search(query);
	if (result.isErr()) {
		return { query, results: [], error: result.error.message };
	}

	return { query, results: result.value, error: null };
};
