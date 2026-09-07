import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params }) => {
	const lobby = await unwrapAsync(locals.services.liveLobbies().get(params.id));

	// Prefer the durable lobbies detail URL when ensureStarted has linked it.
	if (lobby.lobbyId) {
		redirect(302, localizeHref(`/replays/${lobby.lobbyId}`, locals.locale));
	}

	// Heal missed lobbies_live.lobby links: same session already has a durable row.
	const sessionId = Number(lobby.sessionId);
	if (Number.isInteger(sessionId) && sessionId > 0) {
		const match = await unwrapAsync(locals.services.matches().findBySessionId(sessionId));
		if (match?.id) {
			redirect(302, localizeHref(`/replays/${match.id}`, locals.locale));
		}
	}

	return { lobby };
};
