import { getLeaderboardStat, getPlayerEloFromMatchHistory, getRacePrefix } from './helpers';
import type { CombatRecord, LobbyData, Player } from './types';

export const FACTION = ['US', 'WM', 'UK', 'PE'] as const;

const RACE_IMAGES = ['./images/us.png', './images/wm.png', './images/cw.png', './images/pe.png'];

export function getRaceImage(race: number): string {
	return RACE_IMAGES[race] ?? RACE_IMAGES[0];
}

export function getRankImage(type: number, player: Player): string {
	const stat = getLeaderboardStat(type, player);
	if (!stat || stat.ranklevel < 1) return './images/ranks/no_rank_yet.png';

	const prefix = getRacePrefix(player.race);
	return `./images/ranks/${prefix}_${stat.ranklevel.toString().padStart(2, '0')}.png`;
}

export function formatRanking(ranking: number | undefined): string {
	if (!ranking || ranking < 1) return '—';
	return `#${ranking.toLocaleString()}`;
}

export function formatElo(value: number | null): string {
	if (typeof value !== 'number' || value < 1) return 'NA';
	return value.toLocaleString();
}

export function getCombatRecord(type: number, player: Player): CombatRecord {
	const stat = getLeaderboardStat(type, player);
	const historyElo = getPlayerEloFromMatchHistory(type, player);
	const elo = formatElo(historyElo);

	if (!stat) {
		return { wins: 0, losses: 0, winRate: null, streak: 0, elo };
	}

	const wins = Math.max(0, stat.wins ?? 0);
	const losses = Math.max(0, stat.losses ?? 0);
	const total = wins + losses;
	const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
	const streak = typeof stat.streak === 'number' ? stat.streak : 0;

	return { wins, losses, winRate, streak, elo };
}

export function formatStreak(streak: number): string | null {
	if (!streak) return null;
	return streak > 0 ? `+${streak}` : `${streak}`;
}

export function getPlayerCount(data: LobbyData): number {
	if (data.players?.length) return data.players.length;
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
