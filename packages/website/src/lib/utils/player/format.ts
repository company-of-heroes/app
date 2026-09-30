import { formatRelative as formatRelativeShared } from '@company-of-heroes/ui/format/date';
import type { LeaderboardStat, PlayerEloMap } from '$lib/player';

import {
	formatDuration,
	formatHours,
	formatMatchStamp,
	formatRatio,
	getEloColor,
	getEloTextShadow,
	getMatchTypeIdFromLeaderboardId,
	getModeLabel,
	getRaceFromLeaderboardId,
	getRaceLabel,
	getRatioColor,
	getRatioValue,
	getStoredEloForLeaderboard,
	isEliteElo,
	isPremiumElo,
	isRankedLeaderboard,
	normalizeMapName,
	winrate
} from '@company-of-heroes/ui/format/player-format';
export {
	formatDuration,
	formatHours,
	formatMatchStamp,
	formatRatio,
	getEloColor,
	getEloTextShadow,
	getMatchTypeIdFromLeaderboardId,
	getModeLabel,
	getRaceFromLeaderboardId,
	getRaceLabel,
	getRatioColor,
	getRatioValue,
	getStoredEloForLeaderboard,
	isEliteElo,
	isPremiumElo,
	isRankedLeaderboard,
	normalizeMapName,
	winrate
} from '@company-of-heroes/ui/format/player-format';

export const MATCH_TYPES: Record<number, string> = {
	0: 'Basic Match',
	1: '1 VS. 1',
	2: '2 VS. 2',
	3: '3 VS. 3',
	4: '4 VS. 4',
	5: '2 VS. 2 AT',
	6: '3 VS. 3 AT',
	7: '4 VS. 4 AT',
	8: 'Operation: Assault 2v2',
	9: 'Operation: Assault 2v2 AT',
	10: 'Operation: Assault 3v3 AT',
	11: 'Operation: Panzerkrieg 2v2',
	12: 'Operation: Panzerkrieg 2v2 AT',
	13: 'Operation: Panzerkrieg 3v3 AT',
	14: 'Skirmish',
	15: 'Operation: Assault',
	16: 'Operation: Panzerkrieg',
	17: 'Operation: Stonewall'
};

const RACE_LABELS: Record<number, string> = {
	0: 'US Forces',
	1: 'Wehrmacht',
	2: 'British Forces',
	3: 'Panzer Elite'
};

export function formatRelativeIso(iso: string, locale = 'en'): string {
	const ms = new Date(iso).getTime();
	if (!Number.isFinite(ms)) {
		return '';
	}

	return formatRelative(ms / 1000, locale);
}

export function formatRelative(unixSeconds: number, locale = 'en'): string {
	return formatRelativeShared(unixSeconds, locale);
}

function lerp(min: number, max: number, t: number): number {
	return min + (max - min) * t;
}

function ratioToProgress(ratio: number): number {
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return 0;
	}

	if (ratio >= 5) {
		return 1;
	}

	if (ratio <= 1) {
		return ratio * 0.5;
	}

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

function eloBandProgress(elo: number, min: number, max: number): number {
	if (elo <= min) {
		return 0;
	}

	if (elo >= max) {
		return 1;
	}

	return (elo - min) / (max - min);
}

function lerpOklch(
	from: { l: number; c: number; h: number },
	to: { l: number; c: number; h: number },
	t: number
): string {
	return `oklch(${lerp(from.l, to.l, t)} ${lerp(from.c, to.c, t)} ${lerp(from.h, to.h, t)})`;
}

export function sortLeaderboardStats(stats: LeaderboardStat[]): LeaderboardStat[] {
	return [...stats].sort((a, b) => {
		const aRanked = isRankedLeaderboard(a.leaderboard_id) ? 0 : 1;
		const bRanked = isRankedLeaderboard(b.leaderboard_id) ? 0 : 1;
		if (aRanked !== bRanked) {
			return aRanked - bRanked;
		}

		return (b.ranklevel ?? 0) - (a.ranklevel ?? 0);
	});
}
