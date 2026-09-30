import type { LobbyPlayer } from '@fknoobs/app';
import type { Match } from '$core/game/lobby';
import type { LobbiesLiveResponse, UsersResponse } from '$core/pocketbase/types';
import { Lobby } from '$core/game/lobby';

type LiveLobbyRecord = LobbiesLiveResponse<
	LobbyPlayer[],
	{
		user: UsersResponse<string[], string[]>;
	}
>;

export function liveLobbyToMatch(record: LiveLobbyRecord): Match {
	const instance = new Lobby(record.createdAt, record.isRanked ?? false, record.isReplay ?? false);
	instance.sessionId = record.sessionId;
	instance.startedAt = record.createdAt;
	instance.map = record.map;
	instance.players = record.players ?? [];
	instance.started = true;
	if (record.matchType != null) {
		instance.logMatchType = record.matchType;
	}

	return instance.toJSON();
}

/**
 * Strips payloads that are only needed while a lobby is live.
 * Use for saved `lobbies` rows only — not `lobbies_live`, which the stream
 * overlay reads for ELO via `matchHistory` over realtime.
 */
export function toPersistablePlayers(players: LobbyPlayer[]): LobbyPlayer[] {
	return players.map(({ matchHistory, storedElo, ...player }) => player);
}

function resolveMe(players: LobbyPlayer[], steamIds?: string[] | null): LobbyPlayer | undefined {
	if (!steamIds?.length) {
		return undefined;
	}

	return players.find((player) => player.steamId && steamIds.includes(player.steamId));
}

export function liveLobbyToLobbyData(record: LiveLobbyRecord): Match {
	const match = liveLobbyToMatch(record);
	const steamIds = record.expand?.user?.steamIds;
	return {
		...match,
		me: resolveMe(match.players, steamIds) ?? match.me
	};
}
