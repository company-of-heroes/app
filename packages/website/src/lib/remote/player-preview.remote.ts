import { query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { toPlayerPreviewData, type PlayerPreviewData } from '@company-of-heroes/ui/player';

const playerIdSchema = z.string().trim().min(1);

export const getPlayerPreview = query(
	playerIdSchema,
	async (id): Promise<PlayerPreviewData | null> => {
		const { locals } = getRequestEvent();
		const result = await locals.services.players().get(id);
		if (result.isErr()) {
			return null;
		}

		return toPlayerPreviewData(result.value);
	}
);
