import { env } from '$env/dynamic/public';

export const RELEASE_PAGE_URL = 'https://github.com/fknoobs/app/releases/latest';
export const REPLAY_MANAGER_RELEASES_URL =
	'https://github.com/fknoobs/app/releases?q=replay-parser';
/** @deprecated Use `latestDownload.url` from `$lib/site/download.svelte` */
export const DOWNLOAD_URL = RELEASE_PAGE_URL;
export const DISCORD_URL = 'https://discord.gg/Cc69hbDnPD';
export const COH_GLOBAL_DISCORD_URL = 'https://discord.gg/5fChmqGKKf';
export const GITHUB_URL = 'https://github.com/fknoobs/app';
export const TWITCH_URL = 'https://www.twitch.tv/commanderredttv';
export const API_URL = env.PUBLIC_API_URL || 'https://api.coh1stats.com';
export const SITE_URL = 'https://coh1stats.com';
export const PRIVACY_URL = `${SITE_URL}/privacy`;
