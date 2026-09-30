/** Player lists for the match detail page. Pure functions; the matches service does the reads. */
import {
	getLiveLobbyMatchTypeId,
	isOccupiedLobbySlot,
	slimLiveLobbyPlayer
} from '@company-of-heroes/ui/live-lobby/slim';
import {
	pickPlayerStats,
	resolveStoredElo,
	type LeaderboardStatLike
} from '@company-of-heroes/ui/live-lobby/stats';
import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby/types';
import type { EloMap } from './ratings';
import type { ListPlayer } from './history-rows';

type RawPlayer = Record<string, unknown> & {
	steamId?: string;
	storedElo?: unknown;
	profile?: { leaderboardStats?: LeaderboardStatLike[] };
};

/** Occupied slots of a lobby roster (max 8, one per slot), each with its raw entry. */
export function rosterPlayers(raw: unknown): { slim: LiveLobbyPlayer; raw: RawPlayer }[] {
	const list = Array.isArray(raw) ? (raw as RawPlayer[]) : [];
	const seenSlot = new Set<number>();
	const pairs: { slim: LiveLobbyPlayer; raw: RawPlayer }[] = [];
	for (let i = 0; i < list.length && pairs.length < 8; i++) {
		if (!isOccupiedLobbySlot(list[i])) {
			continue;
		}

		const slim = slimLiveLobbyPlayer(list[i], i);
		if (!slim) {
			continue;
		}

		if (slim.index >= 0 && slim.index <= 7) {
			if (seenSlot.has(slim.index)) {
				continue;
			}

			seenSlot.add(slim.index);
		}

		pairs.push({ slim, raw: list[i] });
	}
	return pairs;
}

/**
 * Players of a match still in progress: roster slots with ladder stats from the
 * lobby snapshot and ELO from `player_ratings` (skirmish vs AI defaults to 1000).
 */
export function inProgressPlayers(
	raw: unknown,
	isRanked: boolean,
	eloBySteamId: Map<string, EloMap>
): LiveLobbyPlayer[] {
	const pairs = rosterPlayers(raw);
	const matchTypeId = getLiveLobbyMatchTypeId(
		pairs.map((pair) => pair.slim),
		isRanked
	);
	return pairs.map(({ slim, raw: player }) => {
		const rated = player.steamId
			? eloBySteamId.get(String(player.steamId))?.[String(matchTypeId)]?.[String(slim.race)]
			: undefined;
		const elo =
			resolveStoredElo(player.storedElo, matchTypeId, slim.race) ??
			rated?.rating ??
			(matchTypeId === 14 ? 1000 : null);
		const stats = pickPlayerStats(player.profile?.leaderboardStats, matchTypeId, slim.race, elo);
		return stats ? { ...slim, stats } : slim;
	});
}

/** Finished match: the list players that have ladder stats, in the live-lobby shape. */
export function finishedPlayers(players: ListPlayer[]): LiveLobbyPlayer[] {
	return players.flatMap((player, index): LiveLobbyPlayer[] => {
		const profileId = Number(player.profile.profile_id);
		if (!player.stats || !Number.isInteger(profileId) || profileId <= 0) {
			return [];
		}

		return [
			{
				index,
				playerId: player.playerId ?? profileId,
				race: player.race ?? 0,
				alias: player.profile.alias ?? '',
				profileId,
				steamId: player.steamId,
				stats: player.stats
			}
		];
	});
}

type ResultPlayer = { steamId?: string; name?: string; alias?: string; profile_id?: number };

/** The uploader's own player in the result, matched by their linked Steam ids. */
export function submittedBy(
	resultPlayers: ResultPlayer[] | undefined,
	uploaderSteamIds: string[]
): { alias: string; profileId: number; steamId: string } | null {
	for (const player of resultPlayers ?? []) {
		const steamId =
			player.steamId || (player.name?.startsWith('/steam/') ? player.name.slice(7) : '');
		if (steamId && uploaderSteamIds.includes(steamId)) {
			return {
				alias: (player.alias ?? '').trim() || (player.name ?? '').trim(),
				profileId: Number(player.profile_id) || 0,
				steamId
			};
		}
	}
	return null;
}
