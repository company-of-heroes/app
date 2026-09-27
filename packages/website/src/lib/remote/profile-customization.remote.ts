import { form, getRequestEvent, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { localizeHref } from '@company-of-heroes/i18n';
import type { PlayerProfileLink } from '@company-of-heroes/api';
import { unwrapAsync } from '$lib/errors/unwrap';

const MAX_BIO = 500;
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
const STEAM_ID_RE = /^7656119\d{10}$/;

const linkSchema = z.object({
	type: z.enum(['twitch', 'youtube', 'other']),
	url: z.string().url(),
	label: z.string().max(40).optional()
});

function pickSteamId(steamIds: string[] | undefined | null, preferred?: string | null): string | null {
	const ids = (steamIds ?? []).filter((id) => STEAM_ID_RE.test(id));
	if (ids.length === 0) {
		return null;
	}

	if (preferred && ids.includes(preferred)) {
		return preferred;
	}

	return ids[0] ?? null;
}

function buildLinks(input: {
	twitchUrl: string;
	youtubeUrl: string;
	otherLinks: string;
}): PlayerProfileLink[] {
	const links: PlayerProfileLink[] = [];
	const twitch = input.twitchUrl.trim();
	if (twitch) {
		links.push({ type: 'twitch', url: twitch });
	}

	const youtube = input.youtubeUrl.trim();
	if (youtube) {
		links.push({ type: 'youtube', url: youtube });
	}

	let others: Array<{ label?: string; url?: string }> = [];
	if (input.otherLinks.trim()) {
		try {
			const parsed = JSON.parse(input.otherLinks);
			if (Array.isArray(parsed)) {
				others = parsed;
			}
		} catch {
			throw new Error('Other links must be valid JSON.');
		}
	}

	for (const item of others) {
		const url = String(item?.url || '').trim();
		const label = String(item?.label || '').trim();
		if (!url) {
			continue;
		}

		links.push({ type: 'other', url, label });
	}

	const parsed = z.array(linkSchema).max(6).safeParse(links);
	if (!parsed.success) {
		throw new Error('Check your links and try again.');
	}

	return parsed.data;
}

export const loadProfileCustomization = query(async () => {
	const { locals, url } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const fromQuery = url.searchParams.get('steamId') || '';
	const steamId = pickSteamId(locals.user.steamIds, fromQuery);
	if (!steamId) {
		return {
			steamId: null as string | null,
			customization: { bio: null, links: [] as PlayerProfileLink[], backgroundUrl: null }
		};
	}

	const customization = await unwrapAsync(locals.services.players().getCustomization(steamId));
	return { steamId, customization };
});

const updateProfileCustomizationSchema = z.object({
	steamId: z.string().regex(STEAM_ID_RE, 'Enter a valid Steam ID64.'),
	bio: z.string().max(MAX_BIO).optional().default(''),
	twitchUrl: z.string().optional().default(''),
	youtubeUrl: z.string().optional().default(''),
	otherLinks: z.string().optional().default('[]'),
	clearBackground: z.string().optional().default(''),
	background: z
		.instanceof(File)
		.optional()
		.refine((file) => !file || file.size === 0 || file.size <= MAX_BACKGROUND_BYTES, {
			message: 'Background must be 5 MB or smaller.'
		})
		.refine(
			(file) => {
				if (!file || file.size === 0) {
					return true;
				}

				const type = String(file.type || '').toLowerCase();
				if (
					type === 'image/jpeg' ||
					type === 'image/jpg' ||
					type === 'image/png' ||
					type === 'image/webp'
				) {
					return true;
				}

				// Cloudflare / some browsers send octet-stream; accept by extension.
				if (type && type !== 'application/octet-stream') {
					return false;
				}

				const name = file.name.toLowerCase();
				return (
					name.endsWith('.jpg') ||
					name.endsWith('.jpeg') ||
					name.endsWith('.png') ||
					name.endsWith('.webp')
				);
			},
			{ message: 'Background must be a jpeg, png, or webp image.' }
		)
});

export const updateProfileCustomization = form(updateProfileCustomizationSchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const owned = locals.user.steamIds?.includes(data.steamId);
	if (!owned) {
		invalid(locals.t('Link this Steam ID to your account before editing that profile.'));
		return;
	}

	let links: PlayerProfileLink[];
	try {
		links = buildLinks({
			twitchUrl: data.twitchUrl,
			youtubeUrl: data.youtubeUrl,
			otherLinks: data.otherLinks
		});
	} catch (err) {
		invalid(locals.t(err instanceof Error ? err.message : 'Check your links and try again.'));
		return;
	}

	const background =
		data.background && data.background.size > 0
			? (() => {
					const name = data.background.name || 'background.jpg';
					const type = String(data.background.type || '').toLowerCase();
					const allowed =
						type === 'image/jpeg' ||
						type === 'image/jpg' ||
						type === 'image/png' ||
						type === 'image/webp';
					const lower = name.toLowerCase();
					const fromName = lower.endsWith('.png')
						? 'image/png'
						: lower.endsWith('.webp')
							? 'image/webp'
							: 'image/jpeg';
					return new File([data.background], name, {
						type: allowed ? (type === 'image/jpg' ? 'image/jpeg' : type) : fromName
					});
				})()
			: undefined;

	const result = await locals.services.players().updateCustomization({
		steamId: data.steamId,
		bio: data.bio,
		links,
		background,
		clearBackground: data.clearBackground === '1' || data.clearBackground === 'true'
	});
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(
		303,
		localizeHref(`/account/profile?saved=1&steamId=${encodeURIComponent(data.steamId)}`, locals.locale)
	);
});
