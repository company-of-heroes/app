import {
	getRaceFromLeaderboardId,
	getStoredEloForLeaderboard
} from '@company-of-heroes/ui/format/player-format';
import type { LeaderboardStat, PlayerEloMap } from '@company-of-heroes/ui/player/types';
import type { RibbonManifestEntry } from '@company-of-heroes/ui/reward';
import type { RewardView } from '@company-of-heroes/ui/reward/types';
import type { PlayerCardFaction, PlayerCardRibbon } from '@company-of-heroes/ui/supporter/types';
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

/** The four armies, in race order (0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite). */
const RACES = [0, 1, 2, 3];
/** Ribbons on the supporter card. */
const CARD_RIBBONS = 5;

type RibbonInfo = { title: string; series: string | null; level: number | null };

/** Best ranked ladder (highest rank level, then best position) and best stored ELO per army. */
export function cardFactions(
	stats: LeaderboardStat[],
	elo: PlayerEloMap | undefined
): PlayerCardFaction[] {
	return RACES.map((raceId) => {
		const ladders = stats.filter(
			(stat) =>
				isRankedLeaderboard(stat.leaderboard_id) &&
				getRaceFromLeaderboardId(stat.leaderboard_id) === raceId
		);
		const ranked = ladders
			.filter((stat) => stat.rank > 0 && stat.ranklevel > 0)
			.sort((a, b) => b.ranklevel - a.ranklevel || a.rank - b.rank)[0];
		const ratings = ladders.flatMap((stat) => {
			const rating = getStoredEloForLeaderboard(elo, stat.leaderboard_id);
			return rating === null ? [] : [rating];
		});
		return {
			raceId,
			elo: ratings.length > 0 ? Math.round(Math.max(...ratings)) : null,
			rank: ranked?.rank ?? null,
			rankLevel: ranked?.ranklevel ?? null,
			leaderboardId: ranked?.leaderboard_id ?? null
		};
	});
}

/** Ranked games and win rate across every ranked ladder. */
export function cardRecord(stats: LeaderboardStat[]): { matches: number; winRate: number | null } {
	let wins = 0;
	let losses = 0;
	for (const stat of stats) {
		if (isRankedLeaderboard(stat.leaderboard_id)) {
			wins += stat.wins ?? 0;
			losses += stat.losses ?? 0;
		}
	}

	const matches = wins + losses;
	return { matches, winRate: matches > 0 ? wins / matches : null };
}

/**
 * The latest unlocked ribbons, newest first; a ranked series shows only its highest level,
 * like the ribbon rack on the profile.
 */
export function cardRibbons(
	rewards: RewardView[],
	manifest: RibbonManifestEntry[]
): PlayerCardRibbon[] {
	const byKey = new Map<string, RibbonInfo>(
		manifest.map((entry) => [
			entry.file.replace(/\.svg$/, ''),
			{ title: entry.title, series: entry.series ?? null, level: entry.level ?? null }
		])
	);
	const unlocked = rewards
		.filter((reward) => reward.unlockedAt && reward.ribbon && byKey.has(reward.ribbon))
		.sort((a, b) => Date.parse(b.unlockedAt ?? '') - Date.parse(a.unlockedAt ?? ''));
	const best = new Map<string, number>();
	for (const reward of unlocked) {
		const info = byKey.get(reward.ribbon ?? '');
		if (info?.series && info.level) {
			best.set(info.series, Math.max(best.get(info.series) ?? 0, info.level));
		}
	}

	const seen = new Set<string>();
	const ribbons: PlayerCardRibbon[] = [];
	for (const reward of unlocked) {
		const key = reward.ribbon ?? '';
		const info = byKey.get(key);
		if (!info || seen.has(key)) {
			continue;
		}

		if (info.series && info.level !== best.get(info.series)) {
			continue;
		}

		seen.add(key);
		ribbons.push({ key, title: info.title });
	}

	return ribbons.slice(0, CARD_RIBBONS);
}
