import { log, logError } from './logger';

export const RELIC_API_BASE = 'https://coh1-lobby.reliclink.com';

const RELIC_BATCH_SIZE = 50;

type RelicLeaderboardStat = {
	statgroup_id: number;
	leaderboard_id: number;
	wins: number;
	losses: number;
	rank: number;
	ranklevel: number;
	highestrank: number;
	lastmatchdate: number;
};

type RelicMember = {
	name: string;
	alias: string;
	profile_id: number;
	personal_statgroup_id: number;
	level: number;
	xp: number;
};

type RelicPersonalStatResponse = {
	result?: { code: number };
	statGroups?: { members: RelicMember[] }[];
	leaderboardStats?: RelicLeaderboardStat[];
};

export type RelicStats = {
	profileId: number;
	alias: string;
	level: number;
	xp: number;
	totalGames: number;
	totalWins: number;
	winrate: number | null;
	bestRank: number | null;
	lastMatchAt: number | null;
};

export function summarizeRelicStats(
	member: RelicMember,
	stats: RelicLeaderboardStat[]
): RelicStats {
	let totalGames = 0;
	let totalWins = 0;
	let bestRank: number | null = null;
	let lastMatchAt: number | null = null;

	for (const stat of stats) {
		totalGames += (stat.wins ?? 0) + (stat.losses ?? 0);
		totalWins += stat.wins ?? 0;

		if (stat.rank > 0 && (bestRank === null || stat.rank < bestRank)) {
			bestRank = stat.rank;
		}

		if (stat.lastmatchdate > 0 && (lastMatchAt === null || stat.lastmatchdate > lastMatchAt)) {
			lastMatchAt = stat.lastmatchdate;
		}
	}

	return {
		profileId: member.profile_id,
		alias: member.alias,
		level: member.level ?? 0,
		xp: member.xp ?? 0,
		totalGames,
		totalWins,
		winrate: totalGames > 0 ? totalWins / totalGames : null,
		bestRank,
		lastMatchAt
	};
}

async function fetchPersonalStatBatch(steamIds: string[]): Promise<Map<string, RelicStats>> {
	const map = new Map<string, RelicStats>();
	const names = steamIds.map((steamId) => `/steam/${steamId}`);
	const url = new URL(`${RELIC_API_BASE}/community/leaderboard/getpersonalstat`);
	url.searchParams.set('title', 'coh1');
	url.searchParams.set('profile_names', JSON.stringify(names));

	const startedAt = Date.now();
	const response = await fetch(url.toString());

	if (!response.ok) {
		throw new Error(`Relic getpersonalstat failed: ${response.status}`);
	}

	const data = (await response.json()) as RelicPersonalStatResponse;
	const durationMs = Date.now() - startedAt;
	const statsByGroup = new Map<number, RelicLeaderboardStat[]>();

	for (const stat of data.leaderboardStats ?? []) {
		const group = statsByGroup.get(stat.statgroup_id) ?? [];
		group.push(stat);
		statsByGroup.set(stat.statgroup_id, group);
	}

	for (const statGroup of data.statGroups ?? []) {
		for (const member of statGroup.members ?? []) {
			const match = member.name?.match(/^\/steam\/(\d+)$/);
			if (!match) {
				continue;
			}

			map.set(
				match[1],
				summarizeRelicStats(member, statsByGroup.get(member.personal_statgroup_id) ?? [])
			);
		}
	}

	log('debug', 'relic personal stats fetched', {
		requested: steamIds.length,
		returned: map.size,
		durationMs
	});

	return map;
}

export async function getRelicStats(steamIds: string[]): Promise<Map<string, RelicStats>> {
	const map = new Map<string, RelicStats>();
	if (steamIds.length === 0) {
		return map;
	}

	for (let index = 0; index < steamIds.length; index += RELIC_BATCH_SIZE) {
		const chunk = steamIds.slice(index, index + RELIC_BATCH_SIZE);

		try {
			const batch = await fetchPersonalStatBatch(chunk);
			for (const [steamId, stats] of batch) {
				map.set(steamId, stats);
			}
		} catch (error) {
			// Relic data is a soft signal; a failed batch should not abort screening.
			logError('relic personal stats batch failed', error, {
				chunkSize: chunk.length,
				chunkStart: index
			});
		}
	}

	return map;
}
