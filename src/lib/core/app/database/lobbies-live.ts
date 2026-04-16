import type { Match } from '../context/lobby.svelte';
import { fetch } from '@tauri-apps/plugin-http';
import { exp, pocketbase } from '$core/pocketbase';
import { auth } from '../features/auth';

export class LobbiesLive {
	setLobby(match: Match) {
		return pocketbase
			.collection('lobbies_live')
			.getFirstListItem('', { fetch })
			.then((existingLobby) => {
				return pocketbase.collection('lobbies_live').update(
					existingLobby.id,
					{
						user: auth.userId,
						isRanked: match.isRanked,
						sessionId: match.sessionId,
						map: match.map,
						players: match.players
					},
					{ fetch }
				);
			})
			.catch(() => {
				return pocketbase.collection('lobbies_live').create(
					{
						user: auth.userId,
						isRanked: match.isRanked,
						sessionId: match.sessionId,
						map: match.map,
						players: match.players
					},
					{ fetch }
				);
			});
	}
}
