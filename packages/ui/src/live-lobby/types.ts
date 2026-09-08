export type LiveLobbyPlayerStats = {
	elo: number | null;
	wins: number;
	losses: number;
	streak: number;
	rank: number; // Pos
	rankLevel: number; // Level
};

export type LiveLobbyPlayer = {
	index: number;
	playerId: number;
	type?: number;
	race: number;
	/** Relic lobby team from PopulateGameInfo (0 Allies, 1 Axis). */
	team?: number;
	alias: string;
	profileId: number | null;
	steamId: string | null;
	country?: string | null;
	stats?: LiveLobbyPlayerStats | null;
	likeCount?: number;
};

export type LiveLobby = {
	id: string;
	lobbyId?: string | null;
	sessionId: string;
	map: string;
	isRanked: boolean;
	matchType?: number;
	createdAt: string;
	updatedAt: string;
	hostName: string;
	players: LiveLobbyPlayer[];
	modeLabel: string;
};

/**
 * Relic logs closed/empty slots as Id -1 with Type 3 or 6.
 * Real skirmish AI is Id -1 with Type 1. Replay placeholders use Id 0.
 * Keep in sync with packages/app `isOccupiedLobbySlot`.
 */
export function isOccupiedLiveLobbyPlayer(player: LiveLobbyPlayer): boolean {
	if (player.playerId === -1) {
		return player.type === 1;
	}

	return true;
}

export function isCpuLiveLobbyPlayer(player: LiveLobbyPlayer): boolean {
	return player.playerId === -1;
}

export function isAlliesRace(race: number): boolean {
	return race === 0 || race === 2;
}

export function isAxisRace(race: number): boolean {
	return race === 1 || race === 3;
}

export function teamPlayers(
	players: LiveLobbyPlayer[],
	team: 'allies' | 'axis'
): LiveLobbyPlayer[] {
	const wantTeam = team === 'allies' ? 0 : 1;

	return players.filter(isOccupiedLiveLobbyPlayer).filter((player) => {
		// Skirmish sides come from Relic Team, not race — a human can sit in an
		// Allies slot while race is still wrong/unresolved (or Race 6 → fallback).
		if (player.team === 0 || player.team === 1) {
			return player.team === wantTeam;
		}

		return team === 'allies' ? isAlliesRace(player.race) : isAxisRace(player.race);
	});
}

export function defaultLiveLobbyPlayerLabel(player: LiveLobbyPlayer): string {
	if (isCpuLiveLobbyPlayer(player)) {
		const alias = player.alias.trim();
		if (alias && /^cpu(\b|\s*[-–—])/i.test(alias)) {
			return alias;
		}

		return 'CPU opponent';
	}

	if (player.alias.trim()) {
		return player.alias;
	}

	return `Player ${player.index + 1}`;
}

export function playerRowKey(player: LiveLobbyPlayer, rowIndex = 0): string {
	if (player.profileId != null) {
		return `profile:${player.profileId}`;
	}
	if (player.steamId) {
		return `steam:${player.steamId}`;
	}
	if (player.index != null) {
		return `index:${player.index}`;
	}
	return `row:${rowIndex}`;
}
