import { query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
	toPlayerPreviewData,
	type LeaderboardStat,
	type PlayerEloMap,
	type PlayerPreviewData
} from '@company-of-heroes/ui/player';

const playerIdSchema = z.string().trim().min(1);

export const getPlayerPreview = query(
	playerIdSchema,
	async (id): Promise<PlayerPreviewData | null> => {
		const { locals } = getRequestEvent();
		return locals.services.playerPage.get(id).match(toPlayerPreviewData, () => null);
	}
);

/** Stored lobby ELO per mode/race, for the expandable stats on search cards. */
export const getPlayerElo = query(playerIdSchema, async (steamId) => {
	const { locals } = getRequestEvent();
	const result = await locals.api.ratings.getPlayerRating(steamId);
	return result.isOk() ? (result.value?.elo ?? {}) : {};
});

/** Full ladder stats list + stored ELO, for the expandable tournament player rows. */
export const getPlayerStats = query(
	playerIdSchema,
	async (id): Promise<{ leaderboardStats: LeaderboardStat[]; elo: PlayerEloMap } | null> => {
		const { locals } = getRequestEvent();
		return locals.services.playerPage.get(id).match(
			(player) => ({
				leaderboardStats: player.leaderboardStats as LeaderboardStat[],
				elo: player.elo as PlayerEloMap
			}),
			() => null
		);
	}
);
