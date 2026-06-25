import type { Match } from '$core/game/lobby';
import { fetch } from '@tauri-apps/plugin-http';
import { pocketbase } from '$core/pocketbase';

/**
 * Live lobby repository: upserts the user's currently running match so the
 * community/overlays can show "now playing".
 */
export class LobbiesLive {
	async setLobby(match: Match, userId: string) {
		const data = {
			user: userId,
			isRanked: match.isRanked,
			sessionId: match.sessionId,
			map: match.map,
			players: match.players
		};

		try {
			const existing = await pocketbase
				.collection('lobbies_live')
				.getFirstListItem(`user="${userId}"`, { fetch });

			return await pocketbase.collection('lobbies_live').update(existing.id, data, { fetch });
		} catch {
			return await pocketbase.collection('lobbies_live').create(data, { fetch });
		}
	}
}
