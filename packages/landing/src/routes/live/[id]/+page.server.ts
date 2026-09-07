import { redirect } from '@sveltejs/kit';
import { localizeHref } from '@company-of-heroes/i18n';
import type { ResultAsync } from 'neverthrow';
import type { ApiError, CommunityMatchDetail } from '@company-of-heroes/api';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Only send users to /replays when that page can actually load the match. */
async function redirectToReplayIfAvailable(
	getReplay: (id: string) => ResultAsync<CommunityMatchDetail, ApiError>,
	id: string,
	locale: string
) {
	const result = await getReplay(id);
	if (result.isOk()) {
		redirect(302, localizeHref(`/replays/${id}`, locale));
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const lobby = await unwrapAsync(locals.services.liveLobbies().get(params.id));
	const getReplay = (id: string) => locals.services.replays().get(id);

	// Prefer the durable lobbies detail URL when ensureStarted has linked it.
	if (lobby.lobbyId) {
		await redirectToReplayIfAvailable(getReplay, lobby.lobbyId, locals.locale);
	}

	// Heal missed lobbies_live.lobby links: same session already has a viewable match.
	const sessionId = Number(lobby.sessionId);
	if (Number.isInteger(sessionId) && sessionId > 0) {
		const match = await unwrapAsync(locals.services.matches().findBySessionId(sessionId));
		if (match?.id && (match.needsResult === true || match.hasReplay === true)) {
			await redirectToReplayIfAvailable(getReplay, match.id, locals.locale);
		}
	}

	return { lobby };
};
