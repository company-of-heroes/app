import type { LiveLobby } from '../live-lobby/types';
import { isOccupiedLiveLobbyPlayer } from '../live-lobby/types';
import { formatDurationSeconds } from '../replay/utils';
import type { MatchListRow } from './types';

export function toMatchListRowFromLiveLobby(lobby: LiveLobby): MatchListRow {
	return {
		id: lobby.id,
		map: lobby.map,
		modeLabel: lobby.modeLabel,
		hostName: lobby.hostName,
		createdAt: lobby.createdAt,
		players: lobby.players.filter(isOccupiedLiveLobbyPlayer),
		lobbyId: lobby.lobbyId ?? null,
		sessionId: lobby.sessionId,
		isRanked: lobby.isRanked
	};
}

export function defaultFormatDuration(seconds: number | null | undefined): string {
	return formatDurationSeconds(seconds ?? null);
}
