import { query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { toPlayerPreviewData, type PlayerPreviewData } from '@company-of-heroes/ui/player';

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
