import type { Match } from '$core/game/lobby';
import { fetch } from '@tauri-apps/plugin-http';
import { pocketbase } from '$core/pocketbase';
import { ClientResponseError } from 'pocketbase';

/**
 * Live lobby repository: upserts the user's currently running match so the
 * community/overlays can show "now playing".
 */
export class LobbiesLive {
	async setLobby(match: Match) {
		const user = pocketbase.authStore.record?.id;

		if (!pocketbase.authStore.isValid || !user) {
			console.warn('[LOBBIES_LIVE]: skipping upsert, PocketBase auth is missing or expired');
			return;
		}

		if (!match.sessionId || !match.map || match.players.length === 0) {
			console.warn('[LOBBIES_LIVE]: skipping upsert, match is incomplete', {
				sessionId: match.sessionId,
				map: match.map,
				players: match.players.length
			});
			return;
		}

		const data = {
			user,
			isRanked: match.isRanked,
			sessionId: match.sessionId,
			map: match.map,
			players: match.players
		};

		try {
			const existing = await pocketbase
				.collection('lobbies_live')
				.getFirstListItem(`user="${user}"`, { fetch });

			return await pocketbase.collection('lobbies_live').update(existing.id, data, { fetch });
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return await pocketbase.collection('lobbies_live').create(data, { fetch });
			}

			if (error instanceof ClientResponseError) {
				console.warn('[LOBBIES_LIVE]: upsert failed:', error.status, error.response);
			}

			throw error;
		}
	}
}
