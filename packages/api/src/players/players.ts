import { z } from 'zod';
import { normalizeBaseUrl, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { ResultAsync } from 'neverthrow';
import type { PlayerPageData, PlayerSearchResult } from '@company-of-heroes/ui/player/types';

export type { PlayerPageData, PlayerSearchResult };

const playerSearchResultSchema: z.ZodType<PlayerSearchResult> = z
	.object({
		profileId: z.number(),
		alias: z.string(),
		country: z.string().nullable(),
		level: z.number(),
		steamId: z.string(),
		avatarUrl: z.string(),
		likeCount: z.number().optional(),
		matchCount: z.number().optional()
	})
	.passthrough() as z.ZodType<PlayerSearchResult>;

const playerSearchSchema = z.object({
	items: z.array(playerSearchResultSchema).optional()
});

export type PlayerSearchOptions = {
	requireMatches?: boolean;
};

const playerPageSchema: z.ZodType<PlayerPageData> = z
	.object({
		steamId: z.string(),
		profileId: z.number(),
		alias: z.string(),
		country: z.string().nullable(),
		level: z.number(),
		avatarUrl: z.string(),
		personastate: z.number(),
		gameextrainfo: z.string().nullable(),
		lastlogoff: z.number().nullable(),
		timecreated: z.number().nullable().optional(),
		playtimeForever: z.number().nullable(),
		playtime2weeks: z.number().nullable(),
		leaderboardStats: z.array(z.any()),
		elo: z.record(z.string(), z.any()),
		performance: z.any(),
		matchHistory: z.array(z.any()),
		smurf: z.any().optional().nullable(),
		labels: z.array(z.any()).optional(),
		likeCount: z.number().optional()
	})
	.passthrough() as z.ZodType<PlayerPageData>;

export class PlayersApi {
	constructor(private deps: ApiDeps) {}

	search(
		query: string,
		options: PlayerSearchOptions = {}
	): ResultAsync<PlayerSearchResult[], ApiError> {
		const params = new URLSearchParams({ q: query.trim() });
		if (options.requireMatches) {
			params.set('requireMatches', '1');
		}

		return fetchJson(this.deps.fetch, `${normalizeBaseUrl(this.deps.baseUrl)}/api/player/search?${params}`, {
			fallback: 'Failed to search for player',
			schema: playerSearchSchema,
			onStatus: (status) => {
				if (status === 400) {
					return apiError(400, 'Enter a Steam ID64, Relic profile id, or player name.');
				}
			}
		}).map((data) => data.items ?? []);
	}

	get(id: string): ResultAsync<PlayerPageData, ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/player/${encodeURIComponent(id)}`,
			{
				fallback: 'Failed to load player stats. Please try again later.',
				schema: playerPageSchema,
				// Cold loads pull Relic + Steam + match-history enrichment and often exceed 8s.
				timeoutMs: 45_000,
				onStatus: (status) => {
					if (status === 404) {
						return apiError(
							404,
							'Player not found. Check the Steam ID or profile id and try again.'
						);
					}

					if (status === 400) {
						return apiError(400, 'Enter a valid Steam ID64 or Relic profile id.');
					}
				}
			}
		);
	}
}
