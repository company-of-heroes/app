import type { PlayerProfileLink } from './types';

export const PROFILE_BIO_MAX = 500;
export const PROFILE_BACKGROUND_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_OTHER_LINKS_MAX = 4;

/**
 * Profile links as the edit form shows them. Twitch and YouTube are not editable: the
 * desktop app sets them when a channel is connected.
 */
export type ProfileLinkFields = {
	others: Array<{ label?: string; url?: string }>;
};

export function isStreamingLink(link: PlayerProfileLink): boolean {
	return link.type === 'twitch' || link.type === 'youtube';
}

export function splitProfileLinks(links: PlayerProfileLink[]): ProfileLinkFields {
	return {
		others: links
			.filter((link) => link.type === 'other')
			.map((link) => ({ label: link.label ?? '', url: link.url }))
	};
}
