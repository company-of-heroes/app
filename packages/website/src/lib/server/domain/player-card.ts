import { isRankedLeaderboard } from './ratings';

/** The compact ladder summary of the (older) player card endpoint. */

const FACTIONS = ['US', 'Wehrmacht', 'Brits', 'Panzer Elite'];
/** Relic ladder id ranges (4 per mode, one per faction). */
const MODES: { from: number; label: string; factions: number }[] = [
	{ from: 0, label: 'Basic Match', factions: 4 },
	{ from: 4, label: '1v1', factions: 4 },
	{ from: 8, label: '2v2', factions: 4 },
	{ from: 12, label: '3v3', factions: 4 },
	{ from: 16, label: '4v4', factions: 4 },
	{ from: 42, label: 'Skirmish', factions: 4 },
	// Operations only have the two original armies.
	{ from: 46, label: 'Operation Assault', factions: 2 },
	{ from: 50, label: 'Operation Panzerkrieg', factions: 2 },
	{ from: 54, label: 'Operation Stonewall', factions: 2 }
];

export function ladderLabels(leaderboardId: number): { modeLabel: string; factionLabel: string } {
	const mode = MODES.find(
		(entry) => leaderboardId >= entry.from && leaderboardId < entry.from + entry.factions
	);
	return mode
		? { modeLabel: mode.label, factionLabel: FACTIONS[leaderboardId - mode.from] }
		: { modeLabel: 'Unknown', factionLabel: 'Unknown' };
}

type Stat = {
	leaderboard_id: number;
	ranklevel?: number;
	rank?: number;
	wins?: number;
	losses?: number;
	streak?: number;
};

/** Ranked ladders first, highest rank level first. */
export function cardStats(stats: Stat[]) {
	return [...stats]
		.sort(
			(a, b) =>
				Number(!isRankedLeaderboard(a.leaderboard_id)) -
					Number(!isRankedLeaderboard(b.leaderboard_id)) || (b.ranklevel ?? 0) - (a.ranklevel ?? 0)
		)
		.map((stat) => ({
			leaderboardId: stat.leaderboard_id,
			...ladderLabels(stat.leaderboard_id),
			ranked: isRankedLeaderboard(stat.leaderboard_id),
			ranklevel: stat.ranklevel ?? 0,
			rank: stat.rank ?? 0,
			wins: stat.wins ?? 0,
			losses: stat.losses ?? 0,
			streak: stat.streak ?? 0
		}));
}
