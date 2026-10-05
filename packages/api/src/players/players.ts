import { z } from 'zod';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { RecordModel } from 'pocketbase';
import { type ApiDeps, normalizeBaseUrl, v1Base } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { escapePocketBaseString, fromPbPromise, requireAuth } from '../pb';
import { STEAM_ID_REGEX } from '../ratings/ratings';
import { cloneUploadFile, toUploadFile } from '../upload-file';
import {
	BACKGROUND_UPLOAD,
	EMPTY_CUSTOMIZATION,
	PROFILE_BIO_MAX,
	ownedSteamIds,
	serializeCustomization,
	validateProfileLinks
} from './customization';
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

type CustomizationFields = {
	userId: string;
	bio: string;
	links: PlayerProfileLink[];
	clearBackground: boolean;
};

const COLLECTION = 'player_customizations';

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
		steamBans: z
			.object({ vacBans: z.number(), gameBans: z.number(), daysSinceLastBan: z.number() })
			.optional()
			.nullable(),
		labels: z.array(z.any()).optional(),
		likeCount: z.number().optional(),
		customization: z.any().optional().nullable()
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

		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/players/search?${params}`, {
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
		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/players/${encodeURIComponent(id)}`, {
			fallback: 'Failed to load player stats. Please try again later.',
			schema: playerPageSchema,
			timeoutMs: 45_000,
			onStatus: (status) => {
				if (status === 404) {
					return apiError(404, 'Player not found. Check the Steam ID or profile id and try again.');
				}

				if (status === 400) {
					return apiError(400, 'Enter a valid Steam ID64 or Relic profile id.');
				}
			}
		});
	}

	getCustomization(steamId: string): ResultAsync<PlayerCustomization, ApiError> {
		const id = steamId.trim();
		if (!STEAM_ID_REGEX.test(id)) {
			return errAsync(apiError(400, 'Enter a valid Steam ID64.'));
		}

		return this.#findCustomization(id).map((record) =>
			record
				? serializeCustomization(this.deps.pocketbase, record, this.deps.baseUrl)
				: EMPTY_CUSTOMIZATION
		);
	}

	updateCustomization(
		input: UpdatePlayerCustomizationInput
	): ResultAsync<PlayerCustomization, ApiError> {
		const steamId = input.steamId.trim();
		if (!STEAM_ID_REGEX.test(steamId)) {
			return errAsync(apiError(400, 'Enter a valid Steam ID64.'));
		}

		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const owned = ownedSteamIds(this.deps.pocketbase.authStore.record);
		if (!owned.includes(steamId)) {
			return errAsync(
				apiError(403, 'Link this Steam ID to your account before editing that profile.')
			);
		}

		const bio = (input.bio ?? '').trim();
		if (bio.length > PROFILE_BIO_MAX) {
			return errAsync(apiError(400, `Bio must be ${PROFILE_BIO_MAX} characters or fewer.`));
		}

		const links = validateProfileLinks(input.links ?? []);
		if (links.isErr()) {
			return errAsync(links.error);
		}

		const fields: CustomizationFields = {
			userId: auth.value,
			bio,
			links: links.value,
			clearBackground: Boolean(input.clearBackground)
		};

		return this.#prepareBackground(input, fields.clearBackground).andThen((background) =>
			this.#upsertCustomization(steamId, fields, background).andThen((primary) =>
				this.#syncOwnedProfiles(
					owned.filter((id) => id !== steamId),
					fields,
					background
				).map(() => serializeCustomization(this.deps.pocketbase, primary, this.deps.baseUrl))
			)
		);
	}

	#findCustomization(steamId: string): ResultAsync<RecordModel | null, ApiError> {
		const filter = `steam_id = "${escapePocketBaseString(steamId)}"`;
		return fromPbPromise(
			this.deps.pocketbase.collection(COLLECTION).getFirstListItem(filter, { requestKey: null }),
			'Failed to load profile customization.'
		).orElse((error) => (error.status === 404 ? okAsync(null) : errAsync(error)));
	}

	#prepareBackground(
		input: UpdatePlayerCustomizationInput,
		clear: boolean
	): ResultAsync<File | null, ApiError> {
		const file = input.background;
		if (clear || !file || file.size < 1) {
			return okAsync(null);
		}

		return toUploadFile(file, BACKGROUND_UPLOAD);
	}

	#upsertCustomization(
		steamId: string,
		fields: CustomizationFields,
		background: File | null
	): ResultAsync<RecordModel, ApiError> {
		const body: Record<string, unknown> = {
			steam_id: steamId,
			user: fields.userId,
			bio: fields.bio,
			links: fields.links
		};
		if (fields.clearBackground) {
			body.background = '';
		} else if (background) {
			body.background = cloneUploadFile(background);
		}

		const collection = this.deps.pocketbase.collection(COLLECTION);
		return this.#findCustomization(steamId).andThen((existing) =>
			fromPbPromise(
				existing
					? collection.update(existing.id, body, { requestKey: null })
					: collection.create(body, { requestKey: null }),
				'Could not update your profile.'
			)
		);
	}

	// Sequential: parallel uploads hit Cloudflare subrequest limits on the website,
	// and each request needs its own File copy because a body cannot be sent twice.
	#syncOwnedProfiles(
		steamIds: string[],
		fields: CustomizationFields,
		background: File | null
	): ResultAsync<void, ApiError> {
		return steamIds.reduce<ResultAsync<void, ApiError>>(
			(chain, id) =>
				chain.andThen(() =>
					this.#upsertCustomization(id, fields, background)
						.map(() => undefined)
						.orElse((error) => {
							console.warn('[players] sync customization', id, error.message);
							return okAsync(undefined);
						})
				),
			okAsync(undefined)
		);
	}
}
