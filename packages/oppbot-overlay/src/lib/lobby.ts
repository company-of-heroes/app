import { getLeaderboardStat, getRacePrefix, resolvePlayerElo } from './helpers';
import type { CombatRecord, LobbyData, Player } from './types';

export const FACTION = ['US', 'WM', 'UK', 'PE'] as const;

const RACE_IMAGES = ['./images/us.png', './images/wm.png', './images/cw.png', './images/pe.png'];

export function getRaceImage(race: number): string {
	return RACE_IMAGES[race] ?? RACE_IMAGES[0];
}

export function getRankImage(type: number, player: Player): string {
	const stat = getLeaderboardStat(type, player);
	if (!stat || stat.ranklevel < 1) {
		return './images/ranks/no_rank_yet.png';
	}

	const prefix = getRacePrefix(player.race);
	return `./images/ranks/${prefix}_${stat.ranklevel.toString().padStart(2, '0')}.png`;
}

export function getFlagImage(country: string): string {
	return `https://flagsapi.com/${country.toUpperCase()}/flat/64.png`;
}

export function formatRankLevel(type: number, player: Player): string {
	const stat = getLeaderboardStat(type, player);
	if (!stat || stat.ranklevel < 1) {
		return '—';
	}

	return String(stat.ranklevel);
}

export function formatRanking(ranking: number | undefined): string {
	if (!ranking || ranking < 1) {
		return '—';
	}

	return `#${ranking.toLocaleString()}`;
}

export function formatElo(value: number | null): string {
	if (typeof value !== 'number' || value < 1) {
		return 'NA';
	}

	return value.toLocaleString();
}

function lerp(min: number, max: number, t: number): number {
	return min + (max - min) * t;
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

/** Low = blue, mid = green, pro = gold, elite (2400+) = luminous gold. */
export function getEloColor(elo: number | null | undefined): string {
	if (typeof elo !== 'number' || elo < 1) {
		return 'var(--ink-dim)';
	}

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

export function isPremiumElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 1950;
}

export function isEliteElo(elo: number | null | undefined): boolean {
	return typeof elo === 'number' && elo >= 2400;
}

export function getEloTextShadow(elo: number | null | undefined): string | undefined {
	if (!isPremiumElo(elo)) {
		return undefined;
	}

	const color = getEloColor(elo);
	const brandGold = 'oklch(0.88 0.11 80)';

	if (isEliteElo(elo)) {
		const t = eloBandProgress(elo!, 2400, 2800);
		const outer = lerp(18, 28, t);
		const mid = lerp(10, 16, t);
		return [
			`0 0 1px color-mix(in oklch, ${color} 90%, white)`,
			`0 0 ${mid}px color-mix(in oklch, ${color} 70%, transparent)`,
			`0 0 ${outer}px color-mix(in oklch, ${color} 45%, transparent)`,
			`0 0 ${outer * 1.6}px color-mix(in oklch, ${brandGold} 25%, transparent)`
		].join(', ');
	}

	const t = eloBandProgress(elo!, 1950, 2400);
	const glow = lerp(0.28, 0.48, t);
	const blur = lerp(8, 14, t);
	return `0 0 ${blur}px color-mix(in oklch, ${color} ${Math.round(glow * 100)}%, transparent)`;
}

export function getCombatRecord(type: number, player: Player): CombatRecord {
	const stat = getLeaderboardStat(type, player);
	const eloValue = resolvePlayerElo(type, player);
	const elo = formatElo(eloValue);

	if (!stat) {
		return { wins: 0, losses: 0, winRate: null, streak: 0, elo, eloValue };
	}

	const wins = Math.max(0, stat.wins ?? 0);
	const losses = Math.max(0, stat.losses ?? 0);
	const total = wins + losses;
	const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
	const streak = typeof stat.streak === 'number' ? stat.streak : 0;

	return { wins, losses, winRate, streak, elo, eloValue };
}

export function formatStreak(streak: number): string | null {
	if (!streak) {
		return null;
	}

	return streak > 0 ? `+${streak}` : `${streak}`;
}

export function getPlayerDisplayName(player: Player): string {
	const alias = player.profile?.alias?.trim();
	if (alias) {
		return alias;
	}

	const name = player.name?.trim();
	if (name) {
		return name;
	}

	if (player.playerId === -1) {
		return 'CPU';
	}

	return `Player ${(player.index ?? 0) + 1}`;
}

export function getPlayerCount(data: LobbyData): number {
	if (data.players?.length) {
		return data.players.length;
	}

	return data.teams?.reduce((sum, team) => sum + (team.players?.length ?? 0), 0) ?? 0;
}

export function prepareLobbyData(data: LobbyData): LobbyData {
	if (data.teams) {
		const meId = data.me?.playerId;

		data.teams = [...data.teams].sort((a, b) => {
			const aHasMe = a.players.some((p) => p.playerId === meId) ? 0 : 1;
			const bHasMe = b.players.some((p) => p.playerId === meId) ? 0 : 1;
			return aHasMe - bHasMe;
		});
	}

	return data;
}
