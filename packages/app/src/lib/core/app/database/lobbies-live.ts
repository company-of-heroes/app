import { isOccupiedLobbySlot, type Match } from '$core/game/lobby';
import type { LobbyPlayer, TransformedMatch } from '@fknoobs/app';
import type { LobbiesLiveResponse, UsersResponse } from '$core/pocketbase/types';
import { exp } from '$core/pocketbase';
import { getPlayerRatings, type PlayerRatingRecord } from '$core/pocketbase/player-ratings';
import { api, unwrapApi } from '$core/api';
import type { ListResult, RecordSubscription, UnsubscribeFunc } from 'pocketbase';
import type { Expand } from '@fknoobs/app';
import {
	LOBBIES_LIVE_STALE_MS,
	LOBBIES_LIVE_HEARTBEAT_MS,
	lobbiesLiveFreshFilter,
	lobbiesLivePublicFilter,
	isLiveLobbyFresh,
	isPublicLiveLobby,
	type LiveLobbyWriteInput,
	type LiveLobbyWritePlayer
} from '@company-of-heroes/api';

export type LiveLobby = Expand<
	LobbiesLiveResponse<
		LobbyPlayer[],
		{
			user: UsersResponse;
		}
	>
> & { players: LobbyPlayer[] };

export {
	LOBBIES_LIVE_STALE_MS,
	LOBBIES_LIVE_HEARTBEAT_MS,
	lobbiesLiveFreshFilter,
	lobbiesLivePublicFilter,
	isLiveLobbyFresh,
	isPublicLiveLobby
};

/**
 * Live lobby repository: upserts each user's currently running match so the
 * community/overlays can show "now playing". One row per authenticated user;
 * multiple users may share the same sessionId while in the same lobby.
 */
export class LobbiesLive {
	async getList(page = 1, perPage = 20): Promise<ListResult<LiveLobby>> {
		const response = await unwrapApi(api.liveLobbies.getList(page, perPage));
		return {
			...response,
			items: response.items.map((item) => exp(item) as unknown as LiveLobby)
		};
	}

	async getOne(id: string): Promise<LiveLobby> {
		const record = await unwrapApi(api.liveLobbies.getOne(id));
		return exp(record) as unknown as LiveLobby;
	}

	/** True when a fresh public live row still points at this saved match / session. */
	async isActiveForMatch(matchId: string, sessionId: number): Promise<boolean> {
		return unwrapApi(api.liveLobbies.isActiveForMatch(matchId, sessionId));
	}

	async subscribe(
		callback: (event: RecordSubscription<LiveLobby>) => void
	): Promise<UnsubscribeFunc>;
	async subscribe(
		id: string,
		callback: (event: RecordSubscription<LiveLobby>) => void
	): Promise<UnsubscribeFunc>;
	async subscribe(
		idOrCallback: string | ((event: RecordSubscription<LiveLobby>) => void),
		maybeCallback?: (event: RecordSubscription<LiveLobby>) => void
	): Promise<UnsubscribeFunc> {
		const topic = typeof idOrCallback === 'string' ? idOrCallback : '*';
		const callback = typeof idOrCallback === 'string' ? maybeCallback! : idOrCallback;

		return unwrapApi(
			api.liveLobbies.subscribe(topic, (event) => {
				callback({
					...event,
					record: exp(event.record) as unknown as LiveLobby
				});
			})
		);
	}

	async setLobby(match: Match) {
		if (!match.sessionId || !match.map || match.players.length === 0) {
			console.warn('[LOBBIES_LIVE]: skipping upsert, match is incomplete', {
				sessionId: match.sessionId,
				map: match.map,
				players: match.players.length
			});
			return;
		}

		const occupied = match.players.filter(isOccupiedLobbySlot);
		const players = match.isReplay ? occupied : await withOverlayEloSources(occupied);
		const data: LiveLobbyWriteInput = {
			sessionId: match.sessionId,
			map: match.map,
			isRanked: match.isRanked,
			isReplay: match.isReplay ?? false,
			matchType: match.matchType,
			players: players as LiveLobbyWritePlayer[]
		};

		try {
			return await unwrapApi(api.liveLobbies.setLobby(data));
		} catch (error) {
			console.warn('[LOBBIES_LIVE]: upsert failed:', error);
			throw error;
		}
	}

	async removeLobby() {
		try {
			return await unwrapApi(api.liveLobbies.removeLobby());
		} catch (error) {
			console.warn('[LOBBIES_LIVE]: delete failed:', error);
			throw error;
		}
	}
}

/** Overlay only needs ratings + match type; drop Relic counters / aliases. */
function slimMatchHistoryForOverlay(
	history: TransformedMatch[] | undefined
): TransformedMatch[] | undefined {
	if (!history?.length) {
		return history;
	}

	return history.map((match) => ({
		matchtype_id: match.matchtype_id,
		completiontime: match.completiontime,
		startgametime: match.startgametime,
		players: (match.players ?? []).map((member) => ({
			profile_id: member.profile_id,
			newrating: member.newrating,
			oldrating: member.oldrating,
			race_id: member.race_id
		}))
	})) as TransformedMatch[];
}

async function withOverlayEloSources(players: LobbyPlayer[]): Promise<LobbyPlayer[]> {
	const steamIds = players
		.map((player) => player.steamId)
		.filter((steamId): steamId is string => Boolean(steamId));
	let ratings = new Map<string, PlayerRatingRecord>();
	try {
		ratings = await getPlayerRatings(steamIds);
	} catch (error) {
		console.warn('[LOBBIES_LIVE]: player ratings lookup failed', error);
	}

	return players.map((player) => {
		const storedElo =
			player.storedElo ?? (player.steamId ? ratings.get(player.steamId)?.elo : undefined);
		return {
			...player,
			storedElo,
			matchHistory: slimMatchHistoryForOverlay(player.matchHistory)
		};
	});
}
