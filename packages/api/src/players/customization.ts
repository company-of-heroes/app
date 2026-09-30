import { z } from 'zod';
import { err, ok, type Result } from 'neverthrow';
import type { RecordModel } from 'pocketbase';
import { normalizeBaseUrl, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { STEAM_ID_REGEX } from '../ratings/ratings';
import type { ToUploadFileOptions } from '../upload-file';
import type { PlayerCustomization, PlayerProfileLink } from '@company-of-heroes/ui/player/types';

import {
	PROFILE_BACKGROUND_MAX_BYTES,
	PROFILE_BIO_MAX,
	PROFILE_OTHER_LINKS_MAX,
	type ProfileLinkFields
} from '@company-of-heroes/ui/player/profile';

export {
	PROFILE_BACKGROUND_MAX_BYTES,
	PROFILE_BIO_MAX,
	PROFILE_OTHER_LINKS_MAX,
	splitProfileLinks,
	type ProfileLinkFields
} from '@company-of-heroes/ui/player/profile';

export const BACKGROUND_UPLOAD: ToUploadFileOptions = {
	maxBytes: PROFILE_BACKGROUND_MAX_BYTES,
	allowed: ['jpeg', 'png', 'webp'],
	fallbackName: 'background.jpg',
	tooLargeMessage: 'Background must be 5 MB or smaller.',
	invalidTypeMessage: 'Background must be a jpeg, png, or webp image.'
};

export const EMPTY_CUSTOMIZATION: PlayerCustomization = {
	bio: null,
	links: [],
	backgroundUrl: null
};

export const playerProfileLinkSchema = z.object({
	type: z.enum(['twitch', 'youtube', 'other']),
	url: z.string().trim().url(),
	label: z
		.string()
		.trim()
		.max(40)
		.nullish()
		.transform((value) => value || undefined)
});

const profileLinksSchema = z.array(playerProfileLinkSchema).max(PROFILE_OTHER_LINKS_MAX + 2);

export function validateProfileLinks(
	links: PlayerProfileLink[]
): Result<PlayerProfileLink[], ApiError> {
	const parsed = profileLinksSchema.safeParse(links);
	return parsed.success ? ok(parsed.data) : err(apiError(400, 'Check your links and try again.'));
}

export function buildProfileLinks(
	fields: ProfileLinkFields
): Result<PlayerProfileLink[], ApiError> {
	const links: PlayerProfileLink[] = [];
	const twitch = fields.twitchUrl.trim();
	if (twitch) {
		links.push({ type: 'twitch', url: twitch });
	}

	const youtube = fields.youtubeUrl.trim();
	if (youtube) {
		links.push({ type: 'youtube', url: youtube });
	}

	for (const item of fields.others) {
		const url = String(item?.url ?? '').trim();
		if (!url) {
			continue;
		}

		const label = String(item?.label ?? '').trim();
		links.push({ type: 'other', url, label: label || undefined });
	}

	return validateProfileLinks(links);
}

export function parseLinks(raw: unknown): PlayerProfileLink[] {
	let value = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}

	const parsed = z.array(playerProfileLinkSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
}

export function ownedSteamIds(record: RecordModel | null | undefined): string[] {
	const raw = record?.steamIds;
	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.map(String).filter((id) => STEAM_ID_REGEX.test(id));
}

export function pickOwnedSteamId(
	steamIds: readonly (string | number)[] | null | undefined,
	preferred: readonly (string | null | undefined)[] = []
): string | null {
	const owned = (steamIds ?? []).map(String).filter((id) => STEAM_ID_REGEX.test(id));
	for (const id of preferred) {
		if (id && owned.includes(id)) {
			return id;
		}
	}

	return owned[0] ?? null;
}

export function serializeCustomization(
	pb: ApiDeps['pocketbase'],
	record: RecordModel,
	baseUrl?: string
): PlayerCustomization {
	const bio = String(record.bio ?? '').trim();
	const filename = String(record.background ?? '').trim();
	let backgroundUrl: string | null = null;
	if (filename) {
		backgroundUrl = pb.files.getURL(record, filename);
		if (baseUrl && backgroundUrl.startsWith('/')) {
			backgroundUrl = `${normalizeBaseUrl(baseUrl)}${backgroundUrl}`;
		}

		if (record.updated) {
			const separator = backgroundUrl.includes('?') ? '&' : '?';
			backgroundUrl += `${separator}v=${encodeURIComponent(String(record.updated))}`;
		}
	}

	return {
		bio: bio || null,
		links: parseLinks(record.links),
		backgroundUrl
	};
}
