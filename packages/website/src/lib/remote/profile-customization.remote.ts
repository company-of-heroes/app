import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
	PROFILE_BACKGROUND_MAX_BYTES,
	PROFILE_BIO_MAX,
	buildProfileLinks,
	pickOwnedSteamId
} from '@company-of-heroes/api';
import { unwrapAsync } from '$lib/errors/unwrap';

function ownedSteamId(steamId: string): string {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const owned = pickOwnedSteamId(locals.user.steamIds, [steamId]);
	if (owned !== steamId) {
		error(403, locals.t('You can only edit your own profile.'));
	}

	return owned;
}

export const getProfileCustomization = query(z.string().min(1), (steamId) =>
	unwrapAsync(getRequestEvent().locals.api.players.getCustomization(ownedSteamId(steamId)))
);

const saveProfileCustomizationSchema = z.object({
	steamId: z.string().min(1),
	bio: z.string().max(PROFILE_BIO_MAX),
	links: z.object({
		others: z.array(z.object({ label: z.string().optional(), url: z.string().optional() }))
	}),
	background: z
		.instanceof(File)
		.nullable()
		.refine((file) => !file || file.size <= PROFILE_BACKGROUND_MAX_BYTES, {
			message: 'Background must be 5 MB or smaller.'
		}),
	clearBackground: z.boolean()
});

/** Shared profile form (`@company-of-heroes/ui/player`) saves here. */
export const saveProfileCustomization = command(saveProfileCustomizationSchema, async (input) => {
	const { locals } = getRequestEvent();
	const steamId = ownedSteamId(input.steamId);
	const current = await unwrapAsync(locals.api.players.getCustomization(steamId));
	const links = buildProfileLinks(input.links, current.links);
	if (links.isErr()) {
		error(400, locals.t(links.error.message));
	}

	return unwrapAsync(
		locals.api.players.updateCustomization({
			steamId,
			bio: input.bio,
			links: links.value,
			background: input.background ?? undefined,
			clearBackground: input.clearBackground
		})
	);
});
