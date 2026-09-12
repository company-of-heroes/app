import {
	attachMatchHistoryRankLevels,
	collectMatchHistoryProfileIds,
	type TransformedMatch as UiTransformedMatch
} from '@company-of-heroes/ui/player';
import type { LeaderboardStat, TransformedMatch } from '@fknoobs/app';
import { relic } from '$lib/relic';

const PERSONAL_STAT_BATCH = 20;

type StatsMap = Map<number, LeaderboardStat[]>;

async function fetchStatsByProfileIds(
	profileIds: number[],
	seed: StatsMap
): Promise<StatsMap> {
	const byId = new Map(seed);
	const missing = profileIds.filter((id) => !byId.has(id));

	for (let i = 0; i < missing.length; i += PERSONAL_STAT_BATCH) {
		const chunk = missing.slice(i, i + PERSONAL_STAT_BATCH);
		try {
			const profiles = await relic.getProfileByIds(chunk);
			for (const profile of profiles) {
				byId.set(profile.profile_id, profile.leaderboardStats ?? []);
			}
		} catch (error) {
			console.warn('[MATCH-HISTORY]: rank enrichment batch failed:', error);
		}
	}

	return byId;
}

/**
 * Attach current Relic ranklevel to each match player (mode + race).
 * Reuses ownerStats when provided; batches personalstat for opponents.
 */
export async function enrichMatchHistoryRankLevels(
	matches: TransformedMatch[],
	ownerProfileId: number,
	ownerStats?: LeaderboardStat[] | null
): Promise<TransformedMatch[]> {
	if (matches.length === 0) {
		return matches;
	}

	const seed: StatsMap = new Map();
	if (Array.isArray(ownerStats)) {
		seed.set(ownerProfileId, ownerStats);
	}

	const profileIds = collectMatchHistoryProfileIds(matches as UiTransformedMatch[]);
	const statsByProfileId = await fetchStatsByProfileIds(profileIds, seed);
	return attachMatchHistoryRankLevels(
		matches as UiTransformedMatch[],
		statsByProfileId
	) as TransformedMatch[];
}
