/**
 * Member-uploaded replays (`replays` collection): roster, frozen rating snapshot,
 * and the JSON the replay pages expect. Pure functions; the service does the reads.
 */
import { isValidSteamId, type EloMap } from './ratings';

/** A roster entry as parsed from the .rec file. */
export type ReplayRosterPlayer = {
	id?: number | null;
	name?: string;
	alias?: string;
	steamId?: string | null;
	faction?: string;
	doctrineName?: string;
};

/** Player in the frozen snapshot (Relic-result shaped), taken at upload. */
export type SnapshotPlayer = {
	profile_id: number;
	alias: string;
	race_id: number;
	oldrating: number;
	newrating: number;
	wins: number;
	losses: number;
	streak: number;
	rank?: number;
	rankLevel?: number;
	steamId?: string;
	country?: string;
};

export type StatsSnapshot = {
	matchtype_id: number;
	startgametime: number;
	completiontime: number;
	players: SnapshotPlayer[];
	snappedAt?: string;
};

/** What the snapshot builder needs per Steam id. */
export type SteamLadder = {
	rating?: { profileId: number; elo: EloMap };
	relic?: {
		profile_id: number;
		country?: string;
		leaderboardStats: {
			leaderboard_id: number;
			wins?: number;
			losses?: number;
			streak?: number;
			rank?: number;
			ranklevel?: number;
			rating?: number;
		}[];
	};
};

export function parseJsonList<T>(raw: unknown): T[] {
	let value = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}

	return Array.isArray(value)
		? (value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as T[])
		: [];
}

export function parseSnapshot(raw: unknown): StatsSnapshot | null {
	let value = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}

	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as StatsSnapshot)
		: null;
}

/** Steam id from "7656…", "/steam/7656…" or similar; null when not a valid SteamID64. */
export function normalizeSteamId(value: unknown): string | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const raw = String(value).trim();
	const fromPath = /\/steam\/(\d+)/i.exec(raw);
	const candidate = fromPath ? fromPath[1] : raw.replace(/^[^\d]*/, '').replace(/[^\d].*$/, '');
	if (isValidSteamId(candidate)) {
		return candidate;
	}

	return isValidSteamId(raw) ? raw : null;
}

export function raceFromFaction(faction: unknown): number {
	const value = String(faction ?? '').toLowerCase();
	if (value.includes('commonwealth')) {
		return 2;
	}

	if (value.includes('panzer')) {
		return 3;
	}

	return value.startsWith('axis') ? 1 : 0;
}

/** Ranked replays take the ladder of their size; unranked ones the basic ladder (0). */
export function matchTypeFromPlayerCount(count: number, isRanked: boolean): number {
	if (!isRanked) {
		return 0;
	}

	return count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
}

/** Relic often stores the map name as "$12345"; then use the scenario file name. */
export function displayMapName(mapName: string, mapFilename: string): string {
	const name = (mapName ?? '').trim();
	const file = (mapFilename ?? '').trim();
	const fromFile = file ? file.split(/[/\\]/).pop() || file : '';
	if (/^\$\d+$/.test(name) && fromFile) {
		return fromFile;
	}

	return name || fromFile || 'Unknown';
}

const aliasOf = (player: ReplayRosterPlayer, index: number) =>
	(player.name || player.alias || '').trim() || `Player ${index + 1}`;

/**
 * Ratings frozen at upload: stored ELO for the replay's ladder, plus Relic country,
 * win/loss and rank. Profile ids fall back to small replay-local ids, then the slot.
 */
export function buildStatsSnapshot(
	roster: ReplayRosterPlayer[],
	isRanked: boolean,
	durationInSeconds: number,
	ladders: Map<string, SteamLadder>
): StatsSnapshot {
	const matchTypeId = matchTypeFromPlayerCount(roster.length, isRanked);
	const players = roster.map((player, i): SnapshotPlayer => {
		const steamId = normalizeSteamId(player.steamId);
		const race = raceFromFaction(player.faction);
		const localId = Number(player.id);
		let profileId = Number.isFinite(localId) && localId > 0 && localId < 1000 ? localId : i + 1;
		let rating: number | null = null;
		let country: string | null = null;
		let wins = 0;
		let losses = 0;
		let streak = 0;
		let rank = 0;
		let rankLevel = 0;

		const ladder = steamId ? ladders.get(steamId) : undefined;
		if (ladder?.rating) {
			if (ladder.rating.profileId > 0) {
				profileId = ladder.rating.profileId;
			}

			rating = ladder.rating.elo[String(matchTypeId)]?.[String(race)]?.rating ?? null;
		}

		if (ladder?.relic) {
			if (ladder.relic.profile_id > 0) {
				profileId = ladder.relic.profile_id;
			}

			country = ladder.relic.country?.trim() || null;
			const stat = ladder.relic.leaderboardStats.find(
				(entry) => Number(entry.leaderboard_id) === matchTypeId * 4 + race
			);
			if (stat) {
				wins = Number(stat.wins) || 0;
				losses = Number(stat.losses) || 0;
				streak = Number(stat.streak) || 0;
				rank = Number(stat.rank) > 0 ? Number(stat.rank) : 0;
				rankLevel = Number(stat.ranklevel) > 0 ? Number(stat.ranklevel) : 0;
				if ((rating === null || rating < 1) && Number(stat.rating) >= 1) {
					rating = Number(stat.rating);
				}
			}
		}

		const elo = rating !== null && rating >= 1 ? rating : 0;
		return {
			profile_id: profileId,
			alias: aliasOf(player, i),
			race_id: race,
			oldrating: elo,
			newrating: elo,
			wins,
			losses,
			streak,
			rank,
			rankLevel,
			...(steamId ? { steamId } : {}),
			...(country ? { country } : {})
		};
	});

	return {
		matchtype_id: matchTypeId,
		startgametime: 0,
		completiontime: durationInSeconds > 0 ? durationInSeconds : 0,
		players,
		snappedAt: new Date().toISOString()
	};
}

/** Snapshots from before ladder data was captured (all ratings 0, or no country/W-L/rank). */
export function snapshotNeedsRepair(
	snapshot: StatsSnapshot | null,
	roster: ReplayRosterPlayer[]
): boolean {
	if (!roster.some((player) => normalizeSteamId(player.steamId))) {
		return false;
	}

	const players = snapshot?.players ?? [];
	if (
		players.length === 0 ||
		players.every((player) => !(player.oldrating >= 1) && !(player.newrating >= 1))
	) {
		return true;
	}

	return !players.some(
		(player) =>
			!!player.country?.trim() ||
			player.wins > 0 ||
			player.losses > 0 ||
			(player.rank ?? 0) > 0 ||
			(player.rankLevel ?? 0) > 0
	);
}

export type CommunityPlayer = {
	playerId: number;
	steamId: string | null;
	race: number;
	faction?: string;
	doctrineName?: string;
	profile: { profile_id: number; alias: string };
	stats?: LiveStats | null;
};
type LiveStats = {
	elo: number | null;
	wins: number;
	losses: number;
	streak: number;
	rank: number;
	rankLevel: number;
};

/** Roster as list players; Relic profile ids come from player_ratings. */
export function toCommunityPlayers(
	roster: ReplayRosterPlayer[],
	profileIdBySteamId: Map<string, number>
): CommunityPlayer[] {
	return roster.map((player, i) => {
		const steamId = normalizeSteamId(player.steamId);
		const profileId = (steamId && profileIdBySteamId.get(steamId)) || 0;
		const faction = (player.faction ?? '').trim();
		const doctrineName = (player.doctrineName ?? '').trim();
		return {
			playerId: profileId > 0 ? profileId : -1,
			steamId,
			race: raceFromFaction(faction),
			...(faction ? { faction } : {}),
			...(doctrineName ? { doctrineName } : {}),
			profile: { profile_id: profileId, alias: aliasOf(player, i) }
		};
	});
}

/** Snapshot entry for a roster slot: same index, else same Steam id, else same alias. */
function snapshotFor(
	players: SnapshotPlayer[],
	community: CommunityPlayer,
	index: number
): SnapshotPlayer | undefined {
	if (index < players.length) {
		return players[index];
	}

	if (community.steamId) {
		const bySteam = players.find((player) => player.steamId === community.steamId);
		if (bySteam) {
			return bySteam;
		}
	}

	const alias = community.profile.alias.trim().toLowerCase();
	return alias
		? players.find((player) => (player.alias ?? '').trim().toLowerCase() === alias)
		: undefined;
}

export function livePlayersFromSnapshot(
	snapshot: StatsSnapshot | null,
	community: CommunityPlayer[]
) {
	const players = snapshot?.players ?? [];
	return community.map((player, i) => {
		const snap: Partial<SnapshotPlayer> = snapshotFor(players, player, i) ?? {};
		const profileId = Number(player.profile.profile_id) || Number(snap.profile_id) || i + 1;
		const elo =
			Number(snap.newrating) >= 1
				? Number(snap.newrating)
				: Number(snap.oldrating) >= 1
					? Number(snap.oldrating)
					: null;
		const wins = Number(snap.wins) || 0;
		const losses = Number(snap.losses) || 0;
		const rank = Number(snap.rank) > 0 ? Number(snap.rank) : 0;
		const rankLevel = Number(snap.rankLevel) > 0 ? Number(snap.rankLevel) : 0;
		const hasStats = elo !== null || wins > 0 || losses > 0 || rank > 0 || rankLevel > 0;
		return {
			index: i,
			playerId: profileId,
			race: Number.isFinite(Number(player.race)) ? Number(player.race) : Number(snap.race_id) || 0,
			alias: player.profile.alias.trim() || (snap.alias ?? '').trim() || `Player ${i + 1}`,
			profileId,
			steamId: player.steamId || snap.steamId || null,
			country: (snap.country ?? '').trim() || null,
			stats: hasStats
				? { elo, wins, losses, streak: Number(snap.streak) || 0, rank, rankLevel }
				: null
		};
	});
}

/** Snapshot players as Relic-style result players (rank fields are not part of results). */
export function resultPlayers(snapshot: StatsSnapshot | null) {
	return (snapshot?.players ?? []).map((player, i) => ({
		profile_id: Number(player.profile_id) || i + 1,
		alias: player.alias,
		race_id: player.race_id,
		oldrating: Number(player.oldrating) || 0,
		newrating: Number(player.newrating) || 0,
		wins: Number(player.wins) || 0,
		losses: Number(player.losses) || 0,
		streak: Number(player.streak) || 0,
		...(player.steamId ? { steamId: player.steamId } : {}),
		...(player.country ? { country: player.country } : {})
	}));
}
