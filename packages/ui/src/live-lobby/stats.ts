import { getLiveLobbyMatchTypeId } from './slim';
import {
	isOccupiedLiveLobbyPlayer,
	teamPlayers,
	type LiveLobbyPlayer,
	type LiveLobbyPlayerStats
} from './types';

/** Minimal shape of a Relic leaderboard stat needed for live-lobby display. */
export type LeaderboardStatLike = {
	leaderboard_id: number;
	wins?: number;
	losses?: number;
	streak?: number;
	rank?: number;
	ranklevel?: number;
};

/**
 * Minimal raw lobby player fields needed to resolve stored ELO + Relic stats.
 * Matches lobbies_live player JSON (and app LobbyPlayer) without host imports.
 */
export type LiveLobbyRawPlayer = {
	index?: number;
	steamId?: string | null;
	storedElo?: unknown;
	profile?: {
		profile_id?: unknown;
		leaderboardStats?: LeaderboardStatLike[] | null;
	};
};

function toFiniteNumber(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/**
 * Maps a basic (0), ranked 1v1–4v4 (1–4), or skirmish (14) match type + race to
 * its Relic leaderboard id. Races: US=0, Wehrmacht=1, Commonwealth=2, PanzerElite=3.
 * Returns null for operations or out-of-range races.
 */
export function leaderboardIdForMatchRace(
	matchTypeId: number,
	race: number
): number | null {
	if (!Number.isInteger(race) || race < 0 || race > 3) {
		return null;
	}

	if (matchTypeId === 14) {
		return 42 + race;
	}

	if (!Number.isInteger(matchTypeId) || matchTypeId < 0 || matchTypeId > 4) {
		return null;
	}

	return matchTypeId * 4 + race;
}

/**
 * Looks up rating from lobby-embedded `storedElo[matchTypeId][race].rating`.
 * Same rules as PocketBase `resolveStoredElo` (finite rating >= 1).
 */
export function resolveStoredElo(
	storedElo: unknown,
	matchTypeId: number,
	race: number
): number | null {
	if (!storedElo || typeof storedElo !== 'object') {
		return null;
	}

	const group = (storedElo as Record<string, unknown>)[String(matchTypeId)];
	if (!group || typeof group !== 'object') {
		return null;
	}

	const slot = (group as Record<string, { rating?: unknown }>)[String(race)];
	const rating = slot ? Number(slot.rating) : NaN;
	return Number.isFinite(rating) && rating >= 1 ? rating : null;
}

/**
 * Picks a player's live-lobby stats for the given match type + race from their
 * Relic leaderboard stats, combined with a resolved ELO. Returns null when there
 * is neither a matching leaderboard row nor a known ELO.
 */
export function pickPlayerStats(
	leaderboardStats: LeaderboardStatLike[] | null | undefined,
	matchTypeId: number,
	race: number,
	elo: number | null
): LiveLobbyPlayerStats | null {
	const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
	const stat =
		leaderboardId != null && Array.isArray(leaderboardStats)
			? leaderboardStats.find((entry) => toFiniteNumber(entry.leaderboard_id) === leaderboardId)
			: undefined;

	if (!stat && elo == null) {
		return null;
	}

	return {
		elo,
		wins: toFiniteNumber(stat?.wins) ?? 0,
		losses: toFiniteNumber(stat?.losses) ?? 0,
		streak: toFiniteNumber(stat?.streak) ?? 0,
		rank: toFiniteNumber(stat?.rank) ?? 0,
		rankLevel: toFiniteNumber(stat?.ranklevel) ?? 0
	};
}

function findRawLiveLobbyPlayer(
	rawPlayers: LiveLobbyRawPlayer[],
	slim: LiveLobbyPlayer
): LiveLobbyRawPlayer | undefined {
	return (
		rawPlayers.find((player) => player.steamId && player.steamId === slim.steamId) ??
		rawPlayers.find((player) => player.profile?.profile_id === slim.profileId) ??
		rawPlayers.find((player) => player.index === slim.index)
	);
}

/**
 * Attaches per-player stats (storedElo + Relic leaderboardStats) onto slim
 * live-lobby players. Shared by the app widget and PocketBase/landing path.
 */
export function attachLiveLobbyStats(
	slimPlayers: LiveLobbyPlayer[],
	rawPlayers: LiveLobbyRawPlayer[],
	isRanked: boolean,
	matchType?: number | null
): LiveLobbyPlayer[] {
	const matchTypeId = getLiveLobbyMatchTypeId(slimPlayers, isRanked, matchType);
	return slimPlayers.map((slim) => {
		if (slim.playerId === -1) {
			return { ...slim, stats: null };
		}

		const raw = findRawLiveLobbyPlayer(rawPlayers, slim);
		if (!raw) {
			return slim;
		}

		const elo =
			matchTypeId === 14
				? resolveStoredElo(raw.storedElo, matchTypeId, slim.race) ?? 1000
				: resolveStoredElo(raw.storedElo, matchTypeId, slim.race);
		const stats = pickPlayerStats(
			raw.profile?.leaderboardStats,
			matchTypeId,
			slim.race,
			elo
		);
		return stats ? { ...slim, stats } : slim;
	});
}

/** True when at least one occupied player carries resolved stats. */
export function hasLiveLobbyStats(players: LiveLobbyPlayer[]): boolean {
	return players.some((player) => isOccupiedLiveLobbyPlayer(player) && player.stats != null);
}

type TeamEloSummary = {
	avg: number | null;
	max: number | null;
	maxAlias: string | null;
};

function teamEloSummary(players: LiveLobbyPlayer[]): TeamEloSummary {
	let total = 0;
	let count = 0;
	let max: number | null = null;
	let maxAlias: string | null = null;

	for (const player of players) {
		const elo = player.stats?.elo;
		if (elo == null) {
			continue;
		}

		total += elo;
		count += 1;
		if (max == null || elo > max) {
			max = elo;
			maxAlias = player.alias.trim() || null;
		}
	}

	return {
		avg: count > 0 ? Math.round(total / count) : null,
		max,
		maxAlias
	};
}

export type LiveLobbyMatchup = {
	alliesAvg: number | null;
	axisAvg: number | null;
	gap: number | null;
	highest: number | null;
	highestAlias: string | null;
};

/**
 * Computes average team ELO, the ELO gap (axis − allies), and the highest-rated
 * player across both teams from resolved player stats.
 */
export function getLiveLobbyMatchup(players: LiveLobbyPlayer[]): LiveLobbyMatchup {
	const allies = teamEloSummary(teamPlayers(players, 'allies'));
	const axis = teamEloSummary(teamPlayers(players, 'axis'));
	const gap = allies.avg != null && axis.avg != null ? axis.avg - allies.avg : null;

	let highest = allies.max;
	let highestAlias = allies.maxAlias;
	if (axis.max != null && (highest == null || axis.max > highest)) {
		highest = axis.max;
		highestAlias = axis.maxAlias;
	}

	return {
		alliesAvg: allies.avg,
		axisAvg: axis.avg,
		gap,
		highest,
		highestAlias
	};
}

export type MatchupGapLabels = {
	none: string;
	even: string;
	axisAhead: (gap: number) => string;
	alliesAhead: (gap: number) => string;
};

/**
 * Formats the ELO gap for display. Pass host `labels` (i18n) to override the
 * English defaults.
 */
export function formatMatchupGap(
	gap: number | null,
	labels?: Partial<MatchupGapLabels>
): string {
	if (gap == null) {
		return labels?.none ?? '—';
	}

	if (gap === 0) {
		return labels?.even ?? 'Even';
	}

	if (gap > 0) {
		return labels?.axisAhead ? labels.axisAhead(gap) : `Axis +${gap}`;
	}

	const abs = Math.abs(gap);
	return labels?.alliesAhead ? labels.alliesAhead(abs) : `Allies +${abs}`;
}
