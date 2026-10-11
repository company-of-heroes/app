import { env } from '$env/dynamic/public';

/**
 * Public website origin. Dev: local website; production: coh1stats.com.
 * Read via `import.meta.env` (defined in vite.config.js), not `$env/static/public`:
 * the replay worker imports this through `$core/http/fetch`.
 */
export const SITE_URL = (
	(env.PUBLIC_SITE_URL as string | undefined) ?? 'https://coh1stats.com'
).replace(/\/$/, '');

export const privacyUrl = `${SITE_URL}/privacy`;
export const accountUrl = `${SITE_URL}/account`;
