import type { PlayerProfileLink } from './types';

export const PROFILE_BIO_MAX = 500;
export const PROFILE_BACKGROUND_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_OTHER_LINKS_MAX = 4;

/** Profile links as the edit form shows them (one Twitch, one YouTube, a few others). */
export type ProfileLinkFields = {
	twitchUrl: string;
	youtubeUrl: string;
	others: Array<{ label?: string; url?: string }>;
};

export function splitProfileLinks(links: PlayerProfileLink[]): ProfileLinkFields {
	return {
		twitchUrl: links.find((link) => link.type === 'twitch')?.url ?? '',
		youtubeUrl: links.find((link) => link.type === 'youtube')?.url ?? '',
		others: links
			.filter((link) => link.type === 'other')
			.map((link) => ({ label: link.label ?? '', url: link.url }))
	};
}
