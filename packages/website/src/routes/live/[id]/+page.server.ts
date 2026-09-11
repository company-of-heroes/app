import { error, redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Live detail is always the durable match page. The PocketBase hook sets
 * `lobbies_live.lobby` on every live upsert — no client/session heal here.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const lobby = await unwrapAsync(locals.services.liveLobbies().get(params.id));

	if (!lobby.lobbyId) {
		error(404, locals.t('That replay is not available.'));
	}

	redirect(302, localizeHref(`/replays/${lobby.lobbyId}`, locals.locale));
};
