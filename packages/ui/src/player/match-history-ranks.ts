import type { LeaderboardStatLike } from '../live-lobby/stats';
import type { TransformedMatch } from './types';

function toFiniteNumber(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** First personal leaderboard id per match type (+ race: US=0, Wehr=1, CW=2, PE=3). */
const PERSONAL_LADDERS: Record<number, number> = {
	1: 4,
	2: 8,
	3: 12,
	4: 16,
	8: 26,
	11: 34,
	14: 42
};

/** Arranged-team leaderboard id per match type (Allies; Axis is +1). */
const TEAM_LADDERS: Record<number, number> = { 5: 20, 6: 22, 7: 24, 9: 30, 10: 32, 12: 38, 13: 40 };

/** Ladders shared by a premade team (Relic team statgroup), not one player. */
export function isTeamMatchType(matchTypeId: number): boolean {
	return matchTypeId in TEAM_LADDERS;
}

/**
 * Match types with their own Relic rank ladder: automatch 1v1–4v4 (1–4), arranged teams (5–7),
 * 2v2 Assault / Panzerkrieg (8–13) and skirmish (14). Basic Match (0) has no ranks.
 */
export function isRankedMatchType(matchTypeId: number): boolean {
	return matchTypeId in PERSONAL_LADDERS || isTeamMatchType(matchTypeId);
}

/** Relic leaderboard id for a player's race in a match, or null when the mode has no ladder. */
export function matchHistoryLeaderboardId(matchTypeId: number, raceId: number): number | null {
	if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	if (matchTypeId in PERSONAL_LADDERS) {
		return PERSONAL_LADDERS[matchTypeId] + raceId;
	}

	if (isTeamMatchType(matchTypeId)) {
		return TEAM_LADDERS[matchTypeId] + (raceId === 1 || raceId === 3 ? 1 : 0);
	}

	return null;
}

/** The stat for a leaderboard when the player holds a rank level on it. */
function rankedStat(
	leaderboardStats: LeaderboardStatLike[] | null | undefined,
	leaderboardId: number | null
): LeaderboardStatLike | undefined {
	if (leaderboardId == null || !Array.isArray(leaderboardStats)) {
		return undefined;
	}

	const stat = leaderboardStats.find(
		(entry) => toFiniteNumber(entry.leaderboard_id) === leaderboardId
	);
	return (toFiniteNumber(stat?.ranklevel) ?? 0) > 0 ? stat : undefined;
}

function rankLevelOf(
	leaderboardStats: LeaderboardStatLike[] | null | undefined,
	leaderboardId: number | null
): number {
	return toFiniteNumber(rankedStat(leaderboardStats, leaderboardId)?.ranklevel) ?? 0;
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
	return rankLevelOf(leaderboardStats, matchHistoryLeaderboardId(matchTypeId, raceId));
}

/** Ladder stats of one premade team: its members and the team statgroup's leaderboard stats. */
export type TeamLadderStats = { profileIds: number[]; stats: LeaderboardStatLike[] };

export type MatchHistoryLadderStats = {
	personal: Map<number, LeaderboardStatLike[]>;
	teams: TeamLadderStats[];
};

type PersonalStatResponse = {
	statGroups?: {
		id: number;
		type?: number;
		members?: { profile_id: number; personal_statgroup_id?: number }[];
	}[];
	leaderboardStats?: (LeaderboardStatLike & { statgroup_id: number })[];
};

/**
 * Splits Relic `getpersonalstat` responses into personal stats per profile and
 * team statgroups (arranged teams the requested players have played in).
 */
export function ladderStatsFromPersonalStats(
	responses: PersonalStatResponse[],
	seed?: Map<number, LeaderboardStatLike[]>
): MatchHistoryLadderStats {
	const personal = new Map(seed);
	const teams = new Map<number, TeamLadderStats>();

	for (const response of responses) {
		const all = response.leaderboardStats ?? [];
		for (const group of response.statGroups ?? []) {
			const members = group.members ?? [];
			const stats = all.filter((stat) => stat.statgroup_id === group.id);
			if (members.length === 1 && members[0].personal_statgroup_id === group.id) {
				personal.set(members[0].profile_id, stats);
			} else if (members.length > 1 && !teams.has(group.id)) {
				teams.set(group.id, { profileIds: members.map((member) => member.profile_id), stats });
			}
		}
	}

	return { personal, teams: [...teams.values()] };
}

/**
 * Ladder stats per player as the companion captured them when a saved lobby started:
 * Relic match id (lobby `sessionId`) → profile id → leaderboard stats.
 */
export type MatchRankSnapshots = Map<number, Map<number, LeaderboardStatLike[]>>;

type SnapshotLobbyPlayer = {
	playerId?: number;
	profile?: { profile_id?: number; leaderboardStats?: LeaderboardStatLike[] | null } | null;
};

/** Rank snapshots from saved lobbies (`sessionId` + raw `players`); duplicates fill each other's gaps. */
export function rankSnapshotsFromLobbies(
	lobbies: { sessionId: number; players?: unknown }[]
): MatchRankSnapshots {
	const snapshots: MatchRankSnapshots = new Map();
	for (const lobby of lobbies) {
		const sessionId = Number(lobby.sessionId);
		if (!Number.isInteger(sessionId) || sessionId <= 0 || !Array.isArray(lobby.players)) {
			continue;
		}

		const byProfile = snapshots.get(sessionId) ?? new Map<number, LeaderboardStatLike[]>();
		for (const player of lobby.players as SnapshotLobbyPlayer[]) {
			const profileId = toFiniteNumber(player?.profile?.profile_id ?? player?.playerId) ?? 0;
			const stats = player?.profile?.leaderboardStats;
			if (profileId > 0 && Array.isArray(stats) && stats.length > 0 && !byProfile.has(profileId)) {
				byProfile.set(profileId, stats);
			}
		}

		if (byProfile.size > 0) {
			snapshots.set(sessionId, byProfile);
		}
	}

	return snapshots;
}

type RankablePlayer = {
	profile_id: number;
	race_id: number;
	teamid: number;
	ranklevel?: number;
	rank?: number;
};

function teamStatsFor(
	teams: TeamLadderStats[],
	teammates: number[]
): LeaderboardStatLike[] | undefined {
	return teams.find(
		(team) =>
			team.profileIds.length === teammates.length &&
			teammates.every((id) => team.profileIds.includes(id))
	)?.stats;
}

/**
 * Attaches `ranklevel` and ladder position `rank` (0 when unknown) on each match player
 * from the mode's own ladder, or the premade team's ladder in arranged team modes.
 * A saved lobby's snapshot gives the rank at match time; otherwise the current ladder is used.
 * Modes without a ladder (Basic Match) get no rank.
 */
export function attachMatchHistoryRankLevels<
	T extends { id: number; matchtype_id: number; players: RankablePlayer[] } = TransformedMatch
>(
	matches: T[],
	statsByProfileId: Map<number, LeaderboardStatLike[]> | Record<number, LeaderboardStatLike[]>,
	teams: TeamLadderStats[] = [],
	snapshots: MatchRankSnapshots = new Map()
): T[] {
	const lookup =
		statsByProfileId instanceof Map
			? statsByProfileId
			: new Map(
					Object.entries(statsByProfileId).map(([id, stats]) => [Number(id), stats] as const)
				);

	return matches.map((match) => {
		const matchType = Number(match.matchtype_id);
		const team = isTeamMatchType(matchType);
		const snapshot = snapshots.get(Number(match.id));
		return {
			...match,
			players: match.players.map((player) => {
				const leaderboardId = matchHistoryLeaderboardId(matchType, Number(player.race_id));
				const snapshotStats = snapshot?.get(Number(player.profile_id));
				// The snapshot wins when it has this ladder, even unranked: that was the rank then.
				const historical = snapshotStats?.find(
					(entry) => toFiniteNumber(entry.leaderboard_id) === leaderboardId
				);
				const stats = historical
					? snapshotStats
					: team
						? teamStatsFor(
								teams,
								match.players
									.filter((mate) => mate.teamid === player.teamid)
									.map((mate) => Number(mate.profile_id))
							)
						: lookup.get(Number(player.profile_id));
				const stat = rankedStat(stats, leaderboardId);
				const rank = toFiniteNumber(stat?.rank) ?? 0;
				return {
					...player,
					ranklevel: toFiniteNumber(stat?.ranklevel) ?? 0,
					rank: rank > 0 ? rank : 0
				};
			})
		};
	});
}

/** Unique positive profile ids across match history (for batch personalstat). */
export function collectMatchHistoryProfileIds(
	matches: { players: { profile_id: number }[] }[]
): number[] {
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
