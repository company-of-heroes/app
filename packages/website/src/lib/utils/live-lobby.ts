import type { TranslateFn } from '$lib/i18n';
import type { LiveLobbyRecord } from '@company-of-heroes/api';
import { getLiveLobbyMatchTypeId, type LiveLobby } from '@company-of-heroes/ui/live-lobby';
import { toMatchListRowFromLiveLobby, type MatchListRow } from '@company-of-heroes/ui/match';
import { MATCH_TYPES } from '$lib/utils/player/format';

export function toLiveLobby(lobby: LiveLobbyRecord, t: TranslateFn): LiveLobby {
	return {
		...lobby,
		modeLabel: t(
			MATCH_TYPES[getLiveLobbyMatchTypeId(lobby.players, lobby.isRanked, lobby.matchType)] ??
				'Custom Game'
		)
	};
}

export function toMatchListRow(lobby: LiveLobby): MatchListRow {
	return toMatchListRowFromLiveLobby(lobby);
}
