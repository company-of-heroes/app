import type { LobbyData, LiveLobbyRecord, Player } from './types';

const MATCH_TYPES: Record<number, string> = {
	0: 'Custom Game',
	1: '1v1',
	2: '2v2',
	3: '3v3',
	4: '4v4',
	14: 'Comp Stomp'
};

/** Closed Relic slots are Id -1 with Type 3/6. Real AI is Type 1. */
function isOccupiedLobbySlot(player: Player): boolean {
	if (player.playerId === -1) return player.type === 1;
	return true;
}

function groupByTeam(players: Player[]) {
	const grouped = new Map<number, Player[]>();
	for (const player of players) {
		const teamPlayers = grouped.get(player.team) ?? [];
		teamPlayers.push(player);
		grouped.set(player.team, teamPlayers);
	}
	return Array.from(grouped.entries()).map(([, teamPlayers]) => ({ players: teamPlayers }));
}

function getMatchType(players: Player[], isRanked?: boolean, matchType?: number | null): number {
	if (matchType === 14 || players.some((player) => player.playerId === -1)) return 14;
	// Custom / unranked always Basic Match — ignore size-like matchType 1–4.
	if (!isRanked) return 0;
	if (typeof matchType === 'number' && matchType >= 0 && matchType <= 4) return matchType;
	const humans = players.filter((player) => player.playerId !== -1);
	if (humans.length === 2) return 1;
	if (humans.length === 4) return 2;
	if (humans.length === 6) return 3;
	if (humans.length === 8) return 4;
	return 0;
}

function formatMapName(map?: string): string {
	if (!map) return 'Unknown Map';
	const match = map.match(/^(\d+)p_(.+)$/);
	if (!match) {
		return map.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
	}
	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase());
	return `${formattedName} (${playerCount})`;
}

function resolveMe(players: Player[], steamIds?: string[] | null) {
	if (!steamIds?.length) return undefined;
	const me = players.find((player) => player.steamId && steamIds.includes(player.steamId));
	if (!me) return undefined;
	return { playerId: me.playerId, index: me.index };
}

export function liveLobbyToLobbyData(
	record: LiveLobbyRecord,
	steamIds?: string[] | null
): LobbyData {
	const players = (record.players ?? []).filter(isOccupiedLobbySlot);
	const matchType = getMatchType(players, record.isRanked, record.matchType);

	return {
		isRanked: record.isRanked,
		isReplay: record.isReplay,
		isSkirmish: matchType === 14,
		map: record.map,
		mapName: formatMapName(record.map),
		matchType,
		type: MATCH_TYPES[matchType] ?? 'Custom Game',
		players,
		teams: groupByTeam(players),
		me: resolveMe(players, steamIds)
	};
}
