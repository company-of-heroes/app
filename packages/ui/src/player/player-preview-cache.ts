import type { PlayerPreviewData } from './types';

const cache = new Map<string, Promise<PlayerPreviewData | null>>();

export function getCachedPlayerPreview(
	id: string,
	load: (id: string) => Promise<PlayerPreviewData | null>
): Promise<PlayerPreviewData | null> {
	const key = id.trim();
	if (!key) {
		return Promise.resolve(null);
	}

	const existing = cache.get(key);
	if (existing) {
		return existing;
	}

	const pending = load(key)
		.then((data) => {
			if (!data) {
				cache.delete(key);
			}

			return data;
		})
		.catch((error) => {
			cache.delete(key);
			throw error;
		});

	cache.set(key, pending);
	return pending;
}

export function clearPlayerPreviewCache() {
	cache.clear();
}

export function toPlayerPreviewData(player: {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	likeCount?: number;
}): PlayerPreviewData {
	return {
		steamId: player.steamId,
		profileId: player.profileId,
		alias: player.alias,
		country: player.country,
		level: player.level,
		avatarUrl: player.avatarUrl,
		likeCount: player.likeCount
	};
}

/** Prefer steamId, then positive profileId, for preview API lookups. */
export function playerPreviewId(input: {
	steamId?: string | null;
	profileId?: number | null;
}): string | null {
	if (input.steamId) {
		return input.steamId;
	}

	if (input.profileId != null && input.profileId > 0) {
		return String(input.profileId);
	}

	return null;
}
