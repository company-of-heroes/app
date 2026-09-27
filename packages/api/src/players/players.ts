import { z } from 'zod';
import { errAsync, ResultAsync } from 'neverthrow';
import { normalizeBaseUrl, resolveAuthHeaders, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import type {
	PlayerCustomization,
	PlayerPageData,
	PlayerProfileLink,
	PlayerSearchResult
} from '@company-of-heroes/ui/player/types';

export type { PlayerCustomization, PlayerPageData, PlayerProfileLink, PlayerSearchResult };

export type UpdatePlayerCustomizationInput = {
	steamId: string;
	bio?: string;
	links?: PlayerProfileLink[];
	background?: File | null;
	clearBackground?: boolean;
};

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
		likeCount: z.number().optional(),
		customization: z.any().optional().nullable()
	})
	.passthrough() as z.ZodType<PlayerPageData>;

const playerProfileLinkSchema: z.ZodType<PlayerProfileLink> = z.object({
	type: z.enum(['twitch', 'youtube', 'other']),
	url: z.string().min(1),
	label: z.string().max(40).nullish().transform((value) => value ?? undefined)
});

const playerCustomizationSchema: z.ZodType<PlayerCustomization> = z.object({
	bio: z.string().nullable(),
	links: z.array(playerProfileLinkSchema),
	backgroundUrl: z.string().nullable()
});

const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;

const ALLOWED_BACKGROUND_MIME: Record<string, string> = {
	'image/jpeg': 'image/jpeg',
	'image/jpg': 'image/jpeg',
	'image/png': 'image/png',
	'image/webp': 'image/webp'
};

function backgroundMimeFromName(name: string): string {
	const lower = name.toLowerCase();
	if (lower.endsWith('.png')) {
		return 'image/png';
	}

	if (lower.endsWith('.webp')) {
		return 'image/webp';
	}

	return 'image/jpeg';
}

function normalizeBackgroundMime(type: string | undefined, filename: string): string {
	const normalized = ALLOWED_BACKGROUND_MIME[String(type || '').toLowerCase().trim()];
	if (normalized) {
		return normalized;
	}

	return backgroundMimeFromName(filename);
}

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

	getCustomization(steamId: string): ResultAsync<PlayerCustomization, ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/player-customization/${encodeURIComponent(steamId)}`,
			{
				fallback: 'Failed to load profile customization.',
				schema: playerCustomizationSchema,
				init: { cache: 'no-store' },
				onStatus: (status) => {
					if (status === 400) {
						return apiError(400, 'Enter a valid Steam ID64.');
					}
				}
			}
		);
	}

	updateCustomization(
		input: UpdatePlayerCustomizationInput
	): ResultAsync<PlayerCustomization, ApiError> {
		const steamId = input.steamId.trim();
		if (!steamId) {
			return errAsync(apiError(400, 'Enter a valid Steam ID64.'));
		}

		const buildForm = (background?: File) => {
			const formData = new FormData();
			formData.append('steamId', steamId);
			if (input.bio !== undefined) {
				formData.append('bio', input.bio);
			}

			if (input.links !== undefined) {
				formData.append('links', JSON.stringify(input.links));
			}

			if (input.clearBackground) {
				formData.append('clearBackground', '1');
			}

			if (background) {
				formData.append('background', background, background.name || 'background.jpg');
			}

			return formData;
		};

		const post = (formData: FormData) =>
			fetchJson(this.deps.fetch, `${normalizeBaseUrl(this.deps.baseUrl)}/api/player-customization`, {
				fallback: 'Could not update your profile.',
				schema: playerCustomizationSchema,
				timeoutMs: 60_000,
				init: {
					method: 'POST',
					headers: resolveAuthHeaders(this.deps),
					body: formData
				},
				onStatus: (status) => {
					if (status === 401) {
						return apiError(401, 'Log in to update your profile.');
					}

					if (status === 403) {
						return apiError(
							403,
							'Link this Steam ID to your account before editing that profile.'
						);
					}
				}
			});

		if (!input.background) {
			return post(buildForm());
		}

		return ResultAsync.fromPromise(input.background.arrayBuffer(), () =>
			apiError(400, 'Invalid background image.')
		).andThen((buffer) => {
			const bytes = new Uint8Array(buffer);
			if (bytes.byteLength < 1) {
				return errAsync(apiError(400, 'Background image is empty.'));
			}

			if (bytes.byteLength > MAX_BACKGROUND_BYTES) {
				return errAsync(apiError(400, 'Background must be 5 MB or smaller.'));
			}

			const filename = input.background!.name || 'background.jpg';
			const mime = normalizeBackgroundMime(input.background!.type, filename);
			const lower = filename.toLowerCase();
			const safeName =
				mime === 'image/png'
					? lower.endsWith('.png')
						? filename
						: 'background.png'
					: mime === 'image/webp'
						? lower.endsWith('.webp')
							? filename
							: 'background.webp'
						: lower.endsWith('.jpeg') || lower.endsWith('.jpg')
							? filename.replace(/\.jpg$/i, '.jpeg')
							: 'background.jpeg';
			const file = new File([bytes], safeName, { type: mime });
			return post(buildForm(file));
		});
	}
}
