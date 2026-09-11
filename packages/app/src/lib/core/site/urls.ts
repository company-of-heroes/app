import { PUBLIC_SITE_URL } from '$env/static/public';

/** Public website origin. Dev: local website; production: coh1stats.com. */
export const SITE_URL = (PUBLIC_SITE_URL ?? 'https://coh1stats.com').replace(/\/$/, '');

export const privacyUrl = `${SITE_URL}/privacy`;
export const accountUrl = `${SITE_URL}/account`;
