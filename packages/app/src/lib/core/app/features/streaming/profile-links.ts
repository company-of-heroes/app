import { error } from '@tauri-apps/plugin-log';
import { pickOwnedSteamId } from '@company-of-heroes/api';
import { app } from '$core/app/context';
import { api } from '$core/api';
import { t } from '$lib/i18n';
import type { StreamPlatform } from './chat';

/** Puts the connected channel on the user's public profile, keeping bio and other links. */
export async function publishProfileLink(platform: StreamPlatform, url: string): Promise<void> {
	const updated = await setProfileLink(platform, url);
	if (!updated) {
		return;
	}

	app.toast.success(
		platform === 'twitch'
			? t('Twitch link added to your profile')
			: t('YouTube link added to your profile')
	);
}

/** Takes a disconnected channel off the user's public profile. */
export async function removeProfileLink(platform: StreamPlatform): Promise<void> {
	await setProfileLink(platform, null);
}

/** Replaces (or with `null` removes) the platform link; resolves true when the profile changed. */
async function setProfileLink(platform: StreamPlatform, url: string | null): Promise<boolean> {
	if (!app.account.isAuthenticated) {
		void error(`[STREAMING]: skip ${platform} profile link — not signed in`);
		return false;
	}

	const steamId = pickOwnedSteamId(app.account.user.steamIds, [app.game.profile?.steam.steamid]);
	if (!steamId) {
		void error(`[STREAMING]: skip ${platform} profile link — no linked Steam ID`);
		return false;
	}

	const current = await api.players.getCustomization(steamId);
	if (current.isErr()) {
		void error(`[STREAMING]: load profile links failed: ${current.error.message}`);
		app.toast.error(t('Could not update your profile link.'));
		return false;
	}

	const { bio, links } = current.value;
	const existing = links.find((link) => link.type === platform);
	if ((existing?.url ?? null) === url) {
		return false;
	}

	const others = links.filter((link) => link.type !== platform);
	const result = await api.players.updateCustomization({
		steamId,
		bio: bio ?? '',
		links: url ? [...others, { type: platform, url }] : others
	});
	if (result.isErr()) {
		void error(`[STREAMING]: update ${platform} link failed: ${result.error.message}`);
		app.toast.error(t('Could not update your profile link.'));
		return false;
	}

	return true;
}
