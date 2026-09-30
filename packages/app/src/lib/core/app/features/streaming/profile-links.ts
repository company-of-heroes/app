import { error } from '@tauri-apps/plugin-log';
import { pickOwnedSteamId } from '@company-of-heroes/api';
import { app } from '$core/app/context';
import { api } from '$core/api';
import { t } from '$lib/i18n';
import type { StreamPlatform } from './chat';

/** Puts the connected channel on the user's public profile, keeping bio and other links. */
export async function publishProfileLink(platform: StreamPlatform, url: string): Promise<void> {
	if (!app.account.isAuthenticated) {
		void error(`[STREAMING]: skip ${platform} profile link — not signed in`);
		return;
	}

	const steamId = pickOwnedSteamId(app.account.user.steamIds, [app.game.profile?.steam.steamid]);
	if (!steamId) {
		void error(`[STREAMING]: skip ${platform} profile link — no linked Steam ID`);
		return;
	}

	const current = await api.players.getCustomization(steamId);
	if (current.isErr()) {
		void error(`[STREAMING]: load profile links failed: ${current.error.message}`);
		app.toast.error(t('Could not update your profile link.'));
		return;
	}

	const { bio, links } = current.value;
	if (links.some((link) => link.type === platform && link.url === url)) {
		return;
	}

	const result = await api.players.updateCustomization({
		steamId,
		bio: bio ?? '',
		links: [...links.filter((link) => link.type !== platform), { type: platform, url }]
	});
	if (result.isErr()) {
		void error(`[STREAMING]: publish ${platform} link failed: ${result.error.message}`);
		app.toast.error(t('Could not update your profile link.'));
		return;
	}

	app.toast.success(
		platform === 'twitch'
			? t('Twitch link added to your profile')
			: t('YouTube link added to your profile')
	);
}
