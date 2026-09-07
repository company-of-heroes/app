import { getRaceFromLeaderboardId, isRanked, Race } from '$lib/utils/game';
import type { LeaderboardStat, RelicProfile } from '@fknoobs/app';
import { getI18n, t } from '$lib/i18n';
import { getStoredEloForLeaderboard, type PlayerEloMap } from '$lib/utils/player-elo';

export const RANKED_MODE_GROUPS = [
	{ label: '1v1', ids: [4, 5, 6, 7] },
	{ label: '2v2', ids: [8, 9, 10, 11] },
	{ label: '3v3', ids: [12, 13, 14, 15] },
	{ label: '4v4', ids: [16, 17, 18, 19] }
] as const;

export type RankedModeRow = {
	label: string;
	stat: LeaderboardStat;
	rating: number | null;
};

/** Per mode: faction with highest companion ELO, ties broken by Relic ranklevel. */
export function buildRankedModeRows(
	stats: LeaderboardStat[],
	elo?: PlayerEloMap
): RankedModeRow[] {
	const result: RankedModeRow[] = [];
	for (const group of RANKED_MODE_GROUPS) {
		const candidates = stats.filter(
			(stat) =>
				isRanked(stat.leaderboard_id) &&
				(group.ids as readonly number[]).includes(stat.leaderboard_id)
		);
		let best: LeaderboardStat | null = null;
		let bestRating = Number.NEGATIVE_INFINITY;
		let bestRank = Number.NEGATIVE_INFINITY;
		for (const stat of candidates) {
			const rating = getStoredEloForLeaderboard(elo, stat.leaderboard_id) ?? 0;
			if (rating > bestRating || (rating === bestRating && stat.ranklevel > bestRank)) {
				best = stat;
				bestRating = rating;
				bestRank = stat.ranklevel;
			}
		}
		if (!best) {
			continue;
		}

		result.push({
			label: group.label,
			stat: best,
			rating: getStoredEloForLeaderboard(elo, best.leaderboard_id)
		});
	}
	return result;
}

/** Featured = highest companion ELO among modes with data; ties by Relic ranklevel. */
export function pickFeaturedMode(rows: RankedModeRow[]): RankedModeRow | null {
	let featured: RankedModeRow | null = null;
	let bestRating = Number.NEGATIVE_INFINITY;
	let bestRank = Number.NEGATIVE_INFINITY;
	for (const row of rows) {
		const rating = row.rating ?? 0;
		if (rating > bestRating || (rating === bestRating && row.stat.ranklevel > bestRank)) {
			featured = row;
			bestRating = rating;
			bestRank = row.stat.ranklevel;
		}
	}
	return featured;
}

export function getSteamIdFromProfile(profile: RelicProfile): string {
	return profile.name.replace('/steam/', '');
}

export function getCountryDisplayName(country: string | null | undefined): string | null {
	if (!country) return null;

	const region = String(country).trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(region)) return null;

	try {
		const locale = getI18n().getLocale() || 'en';
		return new Intl.DisplayNames([locale], { type: 'region' }).of(region) || region;
	} catch {
		return region;
	}
}

const RACE_LABELS: Record<Race, string> = {
	[Race.US]: 'US Forces',
	[Race.Wehrmacht]: 'Wehrmacht',
	[Race.Commonwealth]: 'British Forces',
	[Race.PanzerElite]: 'Panzer Elite'
};

export function getRaceLabel(race: Race | number): string {
	return t(RACE_LABELS[race as Race] ?? 'Unknown');
}

export function getRaceLabelFromLeaderboardId(leaderboardId: number): string {
	return getRaceLabel(getRaceFromLeaderboardId(leaderboardId));
}

export function getRatioValue(wins: number, losses: number): number {
	if (losses === 0) return wins > 0 ? Infinity : 0;
	return wins / losses;
}

export type PerformanceWlRow = {
	wins: number;
	losses: number;
};

/** Best map by winrate; prefer maps with at least 3 games when available. */
export function pickBestMap<T extends PerformanceWlRow & { map: string }>(byMap: T[]): T | null {
	const eligible = byMap.filter((map) => map.wins + map.losses >= 3);
	const pool = eligible.length > 0 ? eligible : byMap;
	return (
		[...pool].sort(
			(a, b) => getRatioValue(b.wins, b.losses) - getRatioValue(a.wins, a.losses)
		)[0] ?? null
	);
}

/** Main faction by games played; winrate breaks ties. */
export function pickMainFaction<T extends PerformanceWlRow & { raceId: number }>(
	byFaction: T[]
): T | null {
	return (
		[...byFaction].sort((a, b) => {
			const gamesA = a.wins + a.losses;
			const gamesB = b.wins + b.losses;
			if (gamesB !== gamesA) {
				return gamesB - gamesA;
			}

			return getRatioValue(b.wins, b.losses) - getRatioValue(a.wins, a.losses);
		})[0] ?? null
	);
}

/** Current form streak from newest-first recent matches (+wins / −losses). */
export function deriveFormStreak(matches: { outcome: 0 | 1 }[]): number {
	if (matches.length === 0) {
		return 0;
	}

	const first = matches[0]!.outcome;
	let count = 0;
	for (const match of matches) {
		if (match.outcome !== first) {
			break;
		}

		count += 1;
	}

	return first === 1 ? count : -count;
}

function lerp(min: number, max: number, t: number): number {
	return min + (max - min) * t;
}

function ratioToProgress(ratio: number): number {
	if (!Number.isFinite(ratio) || ratio <= 0) return 0;
	if (ratio >= 5) return 1;
	if (ratio <= 1) return ratio * 0.5;
	return 0.5 + ((ratio - 1) / 4) * 0.5;
}

function interpolateRatioColor(t: number): string {
	const stops = [
		{ t: 0, l: 0.5, c: 0.2, h: 25 },
		{ t: 0.5, l: 0.8, c: 0.14, h: 112 },
		{ t: 1, l: 0.72, c: 0.21, h: 145 }
	] as const;

	if (t <= stops[1].t) {
		const local = t / stops[1].t;
		return `oklch(${lerp(stops[0].l, stops[1].l, local)} ${lerp(stops[0].c, stops[1].c, local)} ${lerp(stops[0].h, stops[1].h, local)})`;
	}

	const local = (t - stops[1].t) / (stops[2].t - stops[1].t);
	return `oklch(${lerp(stops[1].l, stops[2].l, local)} ${lerp(stops[1].c, stops[2].c, local)} ${lerp(stops[1].h, stops[2].h, local)})`;
}

export function getRatioColor(wins: number, losses: number): string {
	if (wins === 0 && losses === 0) return 'var(--color-secondary-400)';

	const ratio = getRatioValue(wins, losses);
	if (ratio === Infinity) return 'oklch(0.72 0.21 145)';

	return interpolateRatioColor(ratioToProgress(ratio));
}

function streakToProgress(streak: number): number {
	if (streak >= 5) return 1;
	if (streak <= -5) return 0;
	return 0.5 + (streak / 5) * 0.5;
}

export function getStreakColor(streak: number): string {
	if (streak === 0) return 'var(--color-secondary-400)';

	return interpolateRatioColor(streakToProgress(streak));
}

function eloBandProgress(elo: number, min: number, max: number): number {
	if (elo <= min) return 0;
	if (elo >= max) return 1;
	return (elo - min) / (max - min);
}

function lerpOklch(
	from: { l: number; c: number; h: number },
	to: { l: number; c: number; h: number },
	t: number
): string {
	return `oklch(${lerp(from.l, to.l, t)} ${lerp(from.c, to.c, t)} ${lerp(from.h, to.h, t)})`;
}

/** Low = blue, mid = green, pro = gold, elite (2400+) = luminous gold. */
export function getEloColor(elo: number | null | undefined): string {
	if (typeof elo !== 'number' || elo < 1) return 'var(--color-secondary-400)';

	if (elo < 1500) {
		return lerpOklch(
			{ l: 0.82, c: 0.09, h: 230 },
			{ l: 0.5, c: 0.15, h: 255 },
			eloBandProgress(elo, 1000, 1500)
		);
	}

	if (elo < 1950) {
		return lerpOklch(
			{ l: 0.84, c: 0.12, h: 145 },
			{ l: 0.52, c: 0.16, h: 155 },
			eloBandProgress(elo, 1500, 1950)
		);
	}

	if (elo < 2400) {
		return lerpOklch(
			{ l: 0.9, c: 0.13, h: 90 },
			{ l: 0.78, c: 0.17, h: 78 },
			eloBandProgress(elo, 1950, 2400)
		);
	}

	// Elite: bright champagne → intense luminous brand gold
	return lerpOklch(
		{ l: 0.95, c: 0.16, h: 88 },
		{ l: 0.88, c: 0.2, h: 78 },
		eloBandProgress(elo, 2400, 2800)
	);
}

export function isPremiumElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 1950;
}

export function isEliteElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 2400;
}

export function getEloTextShadow(elo: number | null | undefined): string | undefined {
	if (!isPremiumElo(elo)) return undefined;

	const color = getEloColor(elo);

	if (isEliteElo(elo)) {
		const t = eloBandProgress(elo!, 2400, 2800);
		const outer = lerp(18, 28, t);
		const mid = lerp(10, 16, t);
		return [
			`0 0 1px color-mix(in oklch, ${color} 90%, white)`,
			`0 0 ${mid}px color-mix(in oklch, ${color} 70%, transparent)`,
			`0 0 ${outer}px color-mix(in oklch, ${color} 45%, transparent)`,
			`0 0 ${outer * 1.6}px color-mix(in oklch, var(--color-primary) 25%, transparent)`
		].join(', ');
	}

	const t = eloBandProgress(elo!, 1950, 2400);
	const glow = lerp(0.28, 0.48, t);
	const blur = lerp(8, 14, t);
	return `0 0 ${blur}px color-mix(in oklch, ${color} ${Math.round(glow * 100)}%, transparent)`;
}

export function formatRatio(wins: number, losses: number): string {
	if (losses > 0) return (wins / losses).toFixed(2);
	if (wins > 0) return '∞';
	return '0.00';
}
