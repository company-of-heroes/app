import type { LeaderboardStat, PlayerEloMap } from '$lib/player';

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

export function isRankedLeaderboard(leaderboardId: number): boolean {
	return leaderboardId >= 4 && leaderboardId <= 19;
}

export function getMatchTypeIdFromLeaderboardId(leaderboardId: number): number | null {
	if (leaderboardId >= 0 && leaderboardId <= 3) return 0;
	if (leaderboardId >= 4 && leaderboardId <= 7) return 1;
	if (leaderboardId >= 8 && leaderboardId <= 11) return 2;
	if (leaderboardId >= 12 && leaderboardId <= 15) return 3;
	if (leaderboardId >= 16 && leaderboardId <= 19) return 4;
	return null;
}

export function getRaceFromLeaderboardId(leaderboardId: number): number {
	if ([4, 8, 12, 16, 0, 42, 46, 50, 54].includes(leaderboardId)) return 0;
	if ([5, 9, 13, 17, 1, 43, 47, 51, 55].includes(leaderboardId)) return 1;
	if ([6, 10, 14, 18, 2, 44].includes(leaderboardId)) return 2;
	if ([7, 11, 15, 19, 3, 45].includes(leaderboardId)) return 3;
	return 0;
}

export function getStoredEloForLeaderboard(
	elo: PlayerEloMap | undefined,
	leaderboardId: number
): number | null {
	const matchType = getMatchTypeIdFromLeaderboardId(leaderboardId);
	if (matchType == null || !elo) {
		return null;
	}

	const slot = elo[String(matchType)]?.[String(getRaceFromLeaderboardId(leaderboardId))];
	if (!slot || typeof slot.rating !== 'number' || slot.rating < 1) {
		return null;
	}

	return slot.rating;
}

export function getRaceLabel(raceId: number): string {
	return RACE_LABELS[raceId] ?? 'Unknown';
}

export function getModeLabel(matchtypeId: number): string {
	return MATCH_TYPES[matchtypeId] ?? `Mode ${matchtypeId}`;
}

export function normalizeMapName(mapName: string, includePlayerCount = true): string {
	const match = mapName.match(/^(\d+)[pP][ _](.+)$/);
	if (!match) {
		return mapName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());

	if (!includePlayerCount) return formattedName;
	return `${formattedName} (${playerCount})`;
}

export function formatRelativeIso(iso: string, locale = 'en'): string {
	const ms = new Date(iso).getTime();
	if (!Number.isFinite(ms)) {
		return '';
	}

	return formatRelative(ms / 1000, locale);
}

export function formatRelative(unixSeconds: number, locale = 'en'): string {
	const delta = Date.now() / 1000 - unixSeconds;
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	const abs = Math.abs(delta);
	if (abs < 60) {
		return rtf.format(Math.round(delta) * -1, 'second');
	}

	if (abs < 3600) {
		return rtf.format(Math.round(delta / 60) * -1, 'minute');
	}

	if (abs < 86400) {
		return rtf.format(Math.round(delta / 3600) * -1, 'hour');
	}

	if (abs < 604800) {
		return rtf.format(Math.round(delta / 86400) * -1, 'day');
	}

	if (abs < 31536000) {
		return rtf.format(Math.round(delta / 604800) * -1, 'week');
	}

	return rtf.format(Math.round(delta / 31536000) * -1, 'year');
}

export function formatDuration(start: number, end: number): string {
	const seconds = Math.max(0, end - start);
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatMatchStamp(unixSeconds: number, locale?: string): string {
	const date = new Date(unixSeconds * 1000);
	return date.toLocaleString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatHours(minutes: number): string {
	return `${Math.round(minutes / 60)} hours`;
}

export function winrate(wins: number, losses: number): string {
	const total = wins + losses;
	if (total === 0) return '-';
	return `${Math.round((wins / total) * 100)}%`;
}

export function formatRatio(wins: number, losses: number): string {
	if (losses > 0) return (wins / losses).toFixed(2);
	if (wins > 0) return '∞';
	return '0.00';
}

export function getRatioValue(wins: number, losses: number): number {
	if (losses === 0) return wins > 0 ? Infinity : 0;
	return wins / losses;
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
	return lerpOklch(
		{ l: 0.95, c: 0.16, h: 88 },
		{ l: 0.88, c: 0.2, h: 78 },
		eloBandProgress(elo, 2400, 2800)
	);
}

export function isEliteElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 2400;
}

export function isPremiumElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 1950;
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

export function sortLeaderboardStats(stats: LeaderboardStat[]): LeaderboardStat[] {
	return [...stats].sort((a, b) => {
		const aRanked = isRankedLeaderboard(a.leaderboard_id) ? 0 : 1;
		const bRanked = isRankedLeaderboard(b.leaderboard_id) ? 0 : 1;
		if (aRanked !== bRanked) return aRanked - bRanked;
		return (b.ranklevel ?? 0) - (a.ranklevel ?? 0);
	});
}
