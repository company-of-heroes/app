import type { Match } from '$core/game/lobby';
import type { LobbyPlayer } from '@fknoobs/app';
import type { LobbiesLiveResponse, UsersResponse } from '$core/pocketbase/types';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '$core/http/fetch';
import { ClientResponseError, type ListResult, type RecordSubscription, type UnsubscribeFunc } from 'pocketbase';
import type { Expand } from '@fknoobs/app';

export type LiveLobby = Expand<
	LobbiesLiveResponse<
		LobbyPlayer[],
		{
			user: UsersResponse;
		}
	>
> & { players: LobbyPlayer[] };

/**
 * Live lobby repository: upserts the user's currently running match so the
 * community/overlays can show "now playing".
 */
export class LobbiesLive {
	async getList(page = 1, perPage = 20): Promise<ListResult<LiveLobby>> {
		const response = await pocketbase.collection('lobbies_live').getList(page, perPage, {
			sort: '-updatedAt',
			expand: 'user',
			fetch
		});

		return {
			...response,
			items: response.items.map((item) => exp(item) as unknown as LiveLobby)
		};
	}

	async getOne(id: string): Promise<LiveLobby> {
		const record = await pocketbase.collection('lobbies_live').getOne(id, {
			expand: 'user',
			fetch
		});

		return exp(record) as unknown as LiveLobby;
	}

	async subscribe(
		callback: (event: RecordSubscription<LiveLobby>) => void
	): Promise<UnsubscribeFunc> {
		return pocketbase.collection('lobbies_live').subscribe<LiveLobby>(
			'*',
			(event) => {
				callback({
					...event,
					record: exp(event.record) as unknown as LiveLobby
				});
			},
			{ fetch }
		);
	}

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

	async removeLobby() {
		const user = pocketbase.authStore.record?.id;

		if (!pocketbase.authStore.isValid || !user) {
			console.warn('[LOBBIES_LIVE]: skipping delete, PocketBase auth is missing or expired');
			return;
		}

		try {
			const existing = await pocketbase
				.collection('lobbies_live')
				.getFirstListItem(`user="${user}"`, { fetch });

			return await pocketbase.collection('lobbies_live').delete(existing.id, { fetch });
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return;
			}

			if (error instanceof ClientResponseError) {
				console.warn('[LOBBIES_LIVE]: delete failed:', error.status, error.response);
			}

			throw error;
		}
	}
}
