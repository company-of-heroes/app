import type { LobbyPlayer } from '@fknoobs/app';
import type { LiveLobby } from '$core/app/database/lobbies-live';
import type { MatchExpanded } from '$core/app/database/matches';
import type { TransformedMatch } from '@fknoobs/app';
import {
	isPlaceholderPlayerName,
	Lobby,
	MATCH_TYPES,
	type Match,
	type MatchTypeId
} from '$core/game/lobby';
import { getString, Race } from '$lib/utils/game';
import { isMePlayer } from '$lib/utils/player-me';
import { isValidSteamId } from '$lib/utils/player-elo';
import { isCpuPlayerName } from '@company-of-heroes/ui/replay';
import dayjs from '$lib/dayjs';
import { sortBy, uniq } from 'lodash-es';
import { t } from '$lib/i18n';

export function formatMapDisplayName(map?: string): string {
	if (!map) {
		return t('Unknown Map');
	}

	const match = map.match(/^(\d+)p_(.+)$/);
	if (!match) {
		return map.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

	return `${formattedName} (${playerCount})`;
}

export function getLiveLobbyMatchType(
	players: LobbyPlayer[],
	isRanked?: boolean,
	matchType?: number | null
): MatchTypeId {
	const isSkirmish = matchType === 14 || players.some((player) => player.playerId === -1);

	if (isSkirmish) {
		return 14;
	}

	if (typeof matchType === 'number' && matchType >= 0 && matchType <= 4) {
		return matchType as MatchTypeId;
	}

	if (!isRanked) {
		return 0;
	}

	const humans = players.filter((player) => player.playerId !== -1);
	if (humans.length === 2) {
		return 1;
	}

	if (humans.length === 4) {
		return 2;
	}

	if (humans.length === 6) {
		return 3;
	}

	if (humans.length === 8) {
		return 4;
	}

	return 0;
}

export function getLiveLobbyModeLabel(
	players: LobbyPlayer[],
	isRanked?: boolean,
	matchType?: number | null
): string {
	return t(MATCH_TYPES[getLiveLobbyMatchType(players, isRanked, matchType)] ?? 'Custom Game');
}

export function getMatchModeLabel(match: MatchExpanded): string {
	return getLiveLobbyModeLabel(match.players ?? [], match.isRanked);
}

export function getPlayerProfileId(player: LobbyPlayer): number | undefined {
	return player.profile?.profile_id ?? (player.playerId > 0 ? player.playerId : undefined);
}

export function getPlayerRowKey(player: LobbyPlayer, rowIndex = 0): string {
	const profileId = getPlayerProfileId(player);
	if (profileId != null) {
		return `profile:${profileId}`;
	}

	if (player.steamId) {
		return `steam:${player.steamId}`;
	}

	if (player.index != null) {
		return `index:${player.index}`;
	}

	return `row:${rowIndex}`;
}

export function getPlayerAlias(player: LobbyPlayer): string {
	if (player.playerId === -1) {
		const raw = player.name?.trim() || player.profile?.alias?.trim();
		if (raw && !isPlaceholderPlayerName(raw)) {
			const label = raw.startsWith('$') ? getString(raw) : raw;
			if (label && (isCpuPlayerName(label) || label !== raw)) {
				return label;
			}
		}

		return t('CPU opponent');
	}

	if (player.profile?.alias) {
		return player.profile.alias;
	}

	if (player.name?.trim()) {
		return player.name.trim();
	}

	if (player.index != null) {
		return t('Player {n}', { n: player.index + 1 });
	}

	const profileId = getPlayerProfileId(player);
	if (profileId != null) {
		return t('Player {n}', { n: profileId });
	}

	return t('Unknown');
}

export function getLobbyPlayerTeamId(
	player: LobbyPlayer,
	result?: TransformedMatch | null
): number {
	const profileId = getPlayerProfileId(player);
	if (result?.players && profileId != null) {
		const matchPlayer = result.players.find((entry) => entry.profile_id === profileId);
		if (matchPlayer?.teamid != null) {
			return matchPlayer.teamid;
		}
	}

	if (player.team != null) {
		return player.team;
	}

	const race = player.race;
	if (race === Race.US || race === Race.Commonwealth) {
		return 0;
	}

	if (race === Race.Wehrmacht || race === Race.PanzerElite) {
		return 1;
	}

	return 0;
}

export function orderLobbyPlayersByTeam(
	players: LobbyPlayer[],
	result?: TransformedMatch | null
): LobbyPlayer[] {
	return sortBy(players, [
		(player) => getLobbyPlayerTeamId(player, result),
		(player) => player.index ?? getPlayerProfileId(player) ?? 0
	]);
}

export function isHighlightedPlayer(player: LobbyPlayer, highlightPlayerId?: number): boolean {
	if (isMePlayer(player)) {
		return true;
	}

	if (highlightPlayerId == null) {
		return false;
	}

	return getPlayerProfileId(player) === highlightPlayerId;
}

export function getAlliesPlayers(players: LobbyPlayer[] = []): LobbyPlayer[] {
	return players.filter((player) => {
		if (player.team === 0 || player.team === 1) {
			return player.team === 0;
		}

		return player.race === Race.US || player.race === Race.Commonwealth;
	});
}

export function getAxisPlayers(players: LobbyPlayer[] = []): LobbyPlayer[] {
	return players.filter((player) => {
		if (player.team === 0 || player.team === 1) {
			return player.team === 1;
		}

		return player.race === Race.Wehrmacht || player.race === Race.PanzerElite;
	});
}

export function liveLobbyToMatch(lobby: LiveLobby): Match {
	const instance = new Lobby(lobby.createdAt, lobby.isRanked ?? false, lobby.isReplay ?? false);
	instance.sessionId = lobby.sessionId;
	instance.startedAt = lobby.createdAt;
	instance.map = lobby.map;
	instance.players = lobby.players ?? [];
	instance.started = true;
	return instance.toJSON();
}

function steamIdFromResultPlayer(player: {
	steamId?: string | null;
	name?: string | null;
}): string | null {
	if (player.steamId && isValidSteamId(player.steamId)) {
		return player.steamId;
	}

	if (typeof player.name === 'string' && player.name.startsWith('/steam/')) {
		const steamId = player.name.slice('/steam/'.length);
		return isValidSteamId(steamId) ? steamId : null;
	}

	return null;
}

export function collectTodayMatchSteamIds(authSteamIds?: string[] | null): string[] {
	const ids = new Set<string>();
	for (const steamId of authSteamIds ?? []) {
		if (isValidSteamId(steamId)) {
			ids.add(steamId);
		}
	}
	return [...ids];
}

/** PocketBase autodate filter value for local midnight. */
export function todayStartFilterValue(): string {
	return dayjs().startOf('day').toISOString().replace('T', ' ');
}

function matchResultIncludesSubject(
	match: MatchExpanded,
	profileId?: number,
	steamIds?: string[]
): boolean {
	const result = match.result as TransformedMatch | null | undefined;
	if (!result?.players?.length) {
		return false;
	}

	for (const player of result.players) {
		if (profileId != null && player.profile_id === profileId) {
			return true;
		}

		const steamId = steamIdFromResultPlayer(player);
		if (steamId && steamIds?.includes(steamId)) {
			return true;
		}
	}

	return false;
}

export function countTodayRecord(
	matches: MatchExpanded[],
	profileId?: number,
	steamIds: string[] = []
) {
	let wins = 0;
	let losses = 0;
	let pending = 0;

	for (const match of matches) {
		if (match.needsResult) {
			pending++;
			continue;
		}

		const result = match.result as TransformedMatch | null | undefined;
		if (!result) {
			continue;
		}

		const player = result.players.find((entry) => {
			if (profileId != null && entry.profile_id === profileId) {
				return true;
			}

			const steamId = steamIdFromResultPlayer(entry);
			return !!steamId && steamIds.includes(steamId);
		});
		if (!player) {
			continue;
		}

		if (player.outcome === 1) {
			wins++;
		} else {
			losses++;
		}
	}

	return { wins, losses, pending, total: matches.length };
}

/** True when the Relic profile is one of the match participants. */
export function matchIncludesPlayer(match: MatchExpanded, profileId: number): boolean {
	if ((match.players ?? []).some((player) => getPlayerProfileId(player) === profileId)) {
		return true;
	}

	const result = match.result as TransformedMatch | null | undefined;
	return !!result?.players?.some((player) => player.profile_id === profileId);
}

/** True when one of the linked Steam accounts participated in the match. */
export function matchIncludesSteamIds(match: MatchExpanded, steamIds: string[]): boolean {
	if (steamIds.length === 0) {
		return false;
	}

	if (
		(match.players ?? []).some(
			(player) => player.steamId && steamIds.includes(String(player.steamId))
		)
	) {
		return true;
	}

	const lobbyPlayersRaw = (match as MatchExpanded & { lobbyPlayers?: unknown }).lobbyPlayers;
	if (Array.isArray(lobbyPlayersRaw)) {
		if (
			lobbyPlayersRaw.some(
				(player) =>
					player &&
					typeof player === 'object' &&
					'steamId' in player &&
					player.steamId &&
					steamIds.includes(String(player.steamId))
			)
		) {
			return true;
		}
	} else if (typeof lobbyPlayersRaw === 'string' && lobbyPlayersRaw.length > 2) {
		for (const steamId of steamIds) {
			if (lobbyPlayersRaw.includes(steamId)) {
				return true;
			}
		}
	}

	return matchResultIncludesSubject(match, undefined, steamIds);
}

/**
 * Matches played today for the logged-in account.
 * Uses steamIds from the user record. Prefer lobbyPlayers when populated;
 * fall back to players/result because lobbyPlayers is still empty on many rows.
 * Callers must client-filter with {@link matchIncludesSteamIds} so nested
 * matchHistory hits in `players` are not counted as participation.
 */
export function todayPlayedMatchesFilter(steamIds: string[] = []): string {
	const who: string[] = [];
	for (const steamId of uniq(steamIds.filter(isValidSteamId))) {
		who.push(`lobbyPlayers ~ "${steamId}"`);
		who.push(`players ~ "${steamId}"`);
		who.push(`result ~ "${steamId}"`);
	}

	if (who.length === 0) {
		return 'id=""';
	}

	const clause = who.length === 1 ? who[0]! : `(${who.join(' || ')})`;
	return `createdAt >= "${todayStartFilterValue()}" && ${clause}`;
}

/** Local-calendar "today" check for match timestamps. */
export function isMatchFromLocalToday(match: Pick<MatchExpanded, 'createdAt'>): boolean {
	return dayjs(match.createdAt).isSame(dayjs(), 'day');
}
