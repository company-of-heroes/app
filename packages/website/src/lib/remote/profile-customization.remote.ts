import { form, getRequestEvent, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { localizeHref } from '@company-of-heroes/i18n';
import {
	PROFILE_BACKGROUND_MAX_BYTES,
	PROFILE_BIO_MAX,
	buildProfileLinks,
	pickOwnedSteamId,
	type PlayerCustomization
} from '@company-of-heroes/api';
import { unwrapAsync } from '$lib/errors/unwrap';

function parseOtherLinks(raw: string): Array<{ label?: string; url?: string }> {
	try {
		const parsed = JSON.parse(raw || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const loadProfileCustomization = query(async () => {
	const { locals, url } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const steamId = pickOwnedSteamId(locals.user.steamIds, [url.searchParams.get('steamId')]);
	if (!steamId) {
		const customization: PlayerCustomization = { bio: null, links: [], backgroundUrl: null };
		return { steamId, customization };
	}

	const customization = await unwrapAsync(locals.services.players().getCustomization(steamId));
	return { steamId, customization };
});

const updateProfileCustomizationSchema = z.object({
	steamId: z.string(),
	bio: z.string().max(PROFILE_BIO_MAX).optional().default(''),
	twitchUrl: z.string().optional().default(''),
	youtubeUrl: z.string().optional().default(''),
	otherLinks: z.string().optional().default('[]'),
	clearBackground: z.string().optional().default(''),
	background: z
		.instanceof(File)
		.optional()
		.refine((file) => !file || file.size <= PROFILE_BACKGROUND_MAX_BYTES, {
			message: 'Background must be 5 MB or smaller.'
		})
});

export const updateProfileCustomization = form(updateProfileCustomizationSchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const links = buildProfileLinks({
		twitchUrl: data.twitchUrl,
		youtubeUrl: data.youtubeUrl,
		others: parseOtherLinks(data.otherLinks)
	});
	if (links.isErr()) {
		invalid(locals.t(links.error.message));
		return;
	}

	const result = await locals.services.players().updateCustomization({
		steamId: data.steamId,
		bio: data.bio,
		links: links.value,
		background: data.background,
		clearBackground: data.clearBackground === '1'
	});
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
		return;
	}

	redirect(
		303,
		localizeHref(
			`/account/profile?saved=1&steamId=${encodeURIComponent(data.steamId)}`,
			locals.locale
		)
	);
});
