import type { LobbyPlayer, TransformedMatch } from '@fknoobs/app';
import { getRaceFromLeaderboardId } from '$lib/utils/game';

import { getMatchTypeIdFromLeaderboardId } from '@company-of-heroes/ui/format/player-format';
export { getMatchTypeIdFromLeaderboardId } from '@company-of-heroes/ui/format/player-format';

export const MIN_STORED_MATCH_TYPE = 0;
export const MAX_STORED_MATCH_TYPE = 7;
export const STEAM_ID_REGEX = /^7656119\d{10}$/;

export type PlayerEloSlot = {
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerEloMap = Record<string, Record<string, PlayerEloSlot>>;

export type PlayerEloSlotInput = {
	matchtypeId: number;
	raceId: number;
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerRatingSnapshot = {
	steamId: string;
	profileId: number;
	alias: string;
	slots: PlayerEloSlotInput[];
};

export function isStoredMatchType(matchtypeId: number): boolean {
	const id = Number(matchtypeId);
	return Number.isInteger(id) && id >= MIN_STORED_MATCH_TYPE && id <= MAX_STORED_MATCH_TYPE;
}

export function isValidSteamId(value: string | undefined | null): value is string {
	return typeof value === 'string' && STEAM_ID_REGEX.test(value);
}

export function getStoredEloRating(
	elo: PlayerEloMap | undefined,
	matchType: number,
	race: number
): number | null {
	if (!elo || !isStoredMatchType(matchType)) {
		return null;
	}

	const slot = elo[String(matchType)]?.[String(race)];
	if (!slot || typeof slot.rating !== 'number' || slot.rating < 1) {
		return null;
	}

	return slot.rating;
}

export function getStoredEloForLeaderboard(
	elo: PlayerEloMap | undefined,
	leaderboardId: number
): number | null {
	const matchType = getMatchTypeIdFromLeaderboardId(leaderboardId);
	if (matchType == null) {
		return null;
	}

	return getStoredEloRating(elo, matchType, getRaceFromLeaderboardId(leaderboardId));
}

function steamIdFromPlayer(player: { steamId?: string; name?: string }): string | null {
	if (isValidSteamId(player.steamId)) {
		return player.steamId;
	}

	if (typeof player.name === 'string') {
		const steamId = player.name.replace('/steam/', '');
		return isValidSteamId(steamId) ? steamId : null;
	}

	return null;
}

function slotFromMatchPlayer(
	match: TransformedMatch,
	player: TransformedMatch['players'][number]
): PlayerEloSlotInput | null {
	const matchtypeId = Number(match.matchtype_id);
	if (!isStoredMatchType(matchtypeId)) {
		return null;
	}

	const rating = Number(player.newrating);
	if (!Number.isFinite(rating) || rating < 1) {
		return null;
	}

	const raceId = Number(player.race_id);
	if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	const matchId = Number(match.id);
	if (!Number.isFinite(matchId) || matchId <= 0) {
		return null;
	}

	const at = Number(match.completiontime ?? match.startgametime ?? 0);
	if (!Number.isFinite(at) || at < 0) {
		return null;
	}

	return {
		matchtypeId,
		raceId,
		rating,
		matchId,
		at
	};
}

function upsertSnapshotSlot(snapshot: PlayerRatingSnapshot, slot: PlayerEloSlotInput): void {
	const existing = snapshot.slots.find(
		(item) => item.matchtypeId === slot.matchtypeId && item.raceId === slot.raceId
	);

	if (!existing) {
		snapshot.slots.push(slot);
		return;
	}

	if (slot.at > existing.at) {
		existing.rating = slot.rating;
		existing.matchId = slot.matchId;
		existing.at = slot.at;
	}
}

export function extractPlayerRatingSnapshots(
	matches: TransformedMatch[] | undefined
): PlayerRatingSnapshot[] {
	if (!matches?.length) {
		return [];
	}

	const bySteamId = new Map<string, PlayerRatingSnapshot>();

	for (const match of matches) {
		if (!isStoredMatchType(Number(match.matchtype_id)) || !match.players?.length) {
			continue;
		}

		for (const player of match.players) {
			const steamId = steamIdFromPlayer(player);
			const slot = slotFromMatchPlayer(match, player);
			const alias = typeof player.alias === 'string' ? player.alias.trim() : '';
			const profileId = Number(player.profile_id);

			if (!steamId || !slot || !alias || !Number.isInteger(profileId) || profileId <= 0) {
				continue;
			}

			const existing = bySteamId.get(steamId);
			if (!existing) {
				bySteamId.set(steamId, {
					steamId,
					profileId,
					alias,
					slots: [slot]
				});
				continue;
			}

			existing.profileId = profileId;
			existing.alias = alias;
			upsertSnapshotSlot(existing, slot);
		}
	}

	return [...bySteamId.values()];
}

export function extractPlayerRatingSnapshotsFromLobby(
	players: LobbyPlayer[] | undefined
): PlayerRatingSnapshot[] {
	if (!players?.length) {
		return [];
	}

	const matches: TransformedMatch[] = [];
	for (const player of players) {
		if (player.playerId === -1 || !player.matchHistory?.length) {
			continue;
		}

		matches.push(...player.matchHistory);
	}

	return extractPlayerRatingSnapshots(matches);
}

function normalizeKeyedContainer(value: unknown): Record<string, unknown> {
	if (value == null) {
		return {};
	}

	if (Array.isArray(value)) {
		const obj: Record<string, unknown> = {};
		for (let i = 0; i < value.length; i++) {
			if (value[i] != null) {
				obj[String(i)] = value[i];
			}
		}
		return obj;
	}

	if (typeof value === 'object') {
		return value as Record<string, unknown>;
	}

	return {};
}

function keyedEntries(value: unknown): [string, unknown][] {
	return Object.entries(normalizeKeyedContainer(value));
}

function asEloSlot(value: unknown): PlayerEloSlot | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const raw = value as Record<string, unknown>;
	const rating = Number(raw.rating);
	const matchId = Number(raw.matchId ?? raw.match_id);
	const at = Number(raw.at);

	if (!Number.isFinite(rating) || rating < 1) {
		return null;
	}

	if (!Number.isFinite(matchId) || matchId <= 0) {
		return null;
	}

	if (!Number.isFinite(at) || at < 0) {
		return null;
	}

	return { rating, matchId, at };
}

export function eloMapFromRecord(elo: unknown): PlayerEloMap {
	const map: PlayerEloMap = {};

	for (const [matchKey, races] of keyedEntries(elo)) {
		for (const [raceKey, value] of keyedEntries(races)) {
			const slot = asEloSlot(value);
			if (!slot) {
				continue;
			}

			const group = map[matchKey] ?? {};
			const current = group[raceKey];
			if (!current || slot.at > current.at) {
				group[raceKey] = slot;
				map[matchKey] = group;
			}
		}
	}

	return map;
}

export function eloMapFromSlots(slots: PlayerEloSlotInput[]): PlayerEloMap {
	const elo: PlayerEloMap = {};

	for (const slot of slots) {
		const matchKey = String(slot.matchtypeId);
		const raceKey = String(slot.raceId);
		const group = elo[matchKey] ?? {};
		const current = group[raceKey];

		if (!current || slot.at > current.at) {
			group[raceKey] = {
				rating: slot.rating,
				matchId: slot.matchId,
				at: slot.at
			};
			elo[matchKey] = group;
		}
	}

	return elo;
}

export function mergeEloMaps(...maps: (PlayerEloMap | undefined)[]): PlayerEloMap {
	const merged: PlayerEloMap = {};

	for (const map of maps) {
		if (!map) {
			continue;
		}

		for (const [matchKey, races] of Object.entries(eloMapFromRecord(map))) {
			for (const [raceKey, slot] of Object.entries(races)) {
				const group = merged[matchKey] ?? {};
				const current = group[raceKey];
				if (!current || slot.at > current.at) {
					group[raceKey] = slot;
					merged[matchKey] = group;
				}
			}
		}
	}

	return merged;
}

export function eloMapForSteamId(
	matches: TransformedMatch[] | undefined,
	steamId: string,
	profileId?: number
): PlayerEloMap {
	const snapshots = extractPlayerRatingSnapshots(matches);
	const own =
		(isValidSteamId(steamId)
			? snapshots.find((snapshot) => snapshot.steamId === steamId)
			: undefined) ??
		(profileId != null
			? snapshots.find((snapshot) => snapshot.profileId === profileId)
			: undefined);

	return own ? eloMapFromSlots(own.slots) : {};
}
