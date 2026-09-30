import type { LobbyPlayer } from '@fknoobs/app';
import type { MatchTypeId } from '$core/game/lobby';
import { getPlayerEloFromMatchHistory } from '$lib/utils/game';
import { getStoredEloRating } from '$lib/utils/player-elo';
import { getPlayerAlias } from './dashboard-utils';
import { t } from '$lib/i18n';

export type TeamEloSummary = {
	avg: number | null;
	max: number | null;
	maxAlias: string | null;
};

export type MatchupStats = {
	allies: TeamEloSummary;
	axis: TeamEloSummary;
	gap: number | null;
};

export function getLobbyPlayerElo(player: LobbyPlayer, matchType: number): number | null {
	if (player.playerId === -1) {
		return null;
	}

	return (
		getPlayerEloFromMatchHistory(matchType, player) ??
		getStoredEloRating(player.storedElo, matchType, player.race)
	);
}

function teamEloSummary(players: LobbyPlayer[], matchType: MatchTypeId): TeamEloSummary {
	let total = 0;
	let count = 0;
	let max: number | null = null;
	let maxAlias: string | null = null;

	for (const player of players) {
		if (player.playerId === -1) {
			continue;
		}

		const elo = getLobbyPlayerElo(player, matchType);
		if (elo == null) {
			continue;
		}

		total += elo;
		count += 1;
		if (max == null || elo > max) {
			max = elo;
			maxAlias = getPlayerAlias(player);
		}
	}

	return {
		avg: count > 0 ? Math.round(total / count) : null,
		max,
		maxAlias
	};
}

export function getMatchupStats(
	allies: LobbyPlayer[],
	axis: LobbyPlayer[],
	matchType: MatchTypeId
): MatchupStats {
	const alliesSummary = teamEloSummary(allies, matchType);
	const axisSummary = teamEloSummary(axis, matchType);
	const gap =
		alliesSummary.avg != null && axisSummary.avg != null
			? axisSummary.avg - alliesSummary.avg
			: null;

	return {
		allies: alliesSummary,
		axis: axisSummary,
		gap
	};
}

export function formatMatchupGap(gap: number | null): string {
	if (gap == null) {
		return '—';
	}

	if (gap === 0) {
		return t('Even');
	}

	if (gap > 0) {
		return t('Axis +{gap}', { gap });
	}

	return t('Allies +{gap}', { gap: Math.abs(gap) });
}
