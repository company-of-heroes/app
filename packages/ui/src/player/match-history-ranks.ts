import {
	leaderboardIdForMatchRace,
	type LeaderboardStatLike
} from '../live-lobby/stats';
import type { MatchHistoryPlayer, TransformedMatch } from './types';

function toFiniteNumber(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** Ranked automatch (1–4) or skirmish (14); Basic Match (0) has no rank badges. */
export function isRankedMatchType(matchTypeId: number): boolean {
	return (
		(Number.isInteger(matchTypeId) && matchTypeId >= 1 && matchTypeId <= 4) ||
		matchTypeId === 14
	);
}

/**
 * Looks up current Relic ranklevel for a match player from leaderboard stats
 * for that match's mode + race. Returns 0 when unranked or missing.
 */
export function rankLevelForMatchPlayer(
	leaderboardStats: LeaderboardStatLike[] | null | undefined,
	matchTypeId: number,
	raceId: number
): number {
	if (!isRankedMatchType(matchTypeId) || !Array.isArray(leaderboardStats)) {
		return 0;
	}

	const leaderboardId = leaderboardIdForMatchRace(matchTypeId, raceId);
	if (leaderboardId == null) {
		return 0;
	}

	const stat = leaderboardStats.find(
		(entry) => toFiniteNumber(entry.leaderboard_id) === leaderboardId
	);
	const level = toFiniteNumber(stat?.ranklevel);
	return level != null && level > 0 ? level : 0;
}

/**
 * Attaches `ranklevel` on each match player from a map of profile_id →
 * Relic leaderboardStats (current ladder, not historical).
 */
export function attachMatchHistoryRankLevels<T extends TransformedMatch>(
	matches: T[],
	statsByProfileId: Map<number, LeaderboardStatLike[]> | Record<number, LeaderboardStatLike[]>
): T[] {
	const lookup =
		statsByProfileId instanceof Map
			? statsByProfileId
			: new Map(
					Object.entries(statsByProfileId).map(([id, stats]) => [Number(id), stats] as const)
				);

	return matches.map((match) => ({
		...match,
		players: match.players.map((player: MatchHistoryPlayer) => {
			const stats = lookup.get(player.profile_id);
			const ranklevel = rankLevelForMatchPlayer(stats, match.matchtype_id, player.race_id);
			return ranklevel > 0 ? { ...player, ranklevel } : { ...player, ranklevel: 0 };
		})
	}));
}

/** Unique positive profile ids across match history (for batch personalstat). */
export function collectMatchHistoryProfileIds(matches: TransformedMatch[]): number[] {
	const seen = new Set<number>();
	const ids: number[] = [];

	for (const match of matches) {
		for (const player of match.players) {
			const id = Number(player.profile_id);
			if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
				continue;
			}

			seen.add(id);
			ids.push(id);
		}
	}

	return ids;
}
