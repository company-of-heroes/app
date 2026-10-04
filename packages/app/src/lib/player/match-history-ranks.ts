import {
	attachMatchHistoryRankLevels,
	collectMatchHistoryProfileIds,
	ladderStatsFromPersonalStats,
	rankSnapshotsFromLobbies
} from '@company-of-heroes/ui/player/match-history-ranks';
import type { LeaderboardStat, TransformedMatch } from '@fknoobs/app';
import { api } from '$core/api';
import { relic } from '$lib/relic';

/**
 * Attach the Relic ranklevel to each match player (mode + race, or the premade team's ladder
 * in arranged team modes): the rank at match time from a saved lobby, else the current one.
 * Reuses ownerStats when provided.
 */
export async function enrichMatchHistoryRankLevels(
	matches: TransformedMatch[],
	ownerProfileId: number,
	ownerStats?: LeaderboardStat[] | null
): Promise<TransformedMatch[]> {
	if (matches.length === 0) {
		return matches;
	}

	// Team statgroups only come back from personalstat, so the owner is fetched too.
	const [responses, lobbies] = await Promise.all([
		relic.getPersonalStats(collectMatchHistoryProfileIds(matches)),
		api.matches
			.getPlayersBySessionIds(matches.map((match) => match.id))
			.unwrapOr([] as { sessionId: number; players: unknown }[])
	]);
	const { personal, teams } = ladderStatsFromPersonalStats(responses);
	if (Array.isArray(ownerStats) && !personal.has(ownerProfileId)) {
		personal.set(ownerProfileId, ownerStats);
	}

	return attachMatchHistoryRankLevels(matches, personal, teams, rankSnapshotsFromLobbies(lobbies));
}
