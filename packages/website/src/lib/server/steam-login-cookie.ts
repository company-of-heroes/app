import type { Cookies } from '@sveltejs/kit';

/** Ties a Steam login to the browser that started it (set on start, checked on the callback). */
const NAME = 'steam_login';

/** coh1stats.com and its subdomains share it: older apps start and finish on api.coh1stats.com. */
function options(url: URL) {
	const shared = url.hostname === 'coh1stats.com' || url.hostname.endsWith('.coh1stats.com');
	return {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax' as const,
		...(shared ? { domain: 'coh1stats.com' } : {})
	};
}

export function setSteamLoginCookie(cookies: Cookies, url: URL, nonce: string) {
	cookies.set(NAME, nonce, { ...options(url), maxAge: 10 * 60 });
}

/** Reads and clears the cookie (one login per start). */
export function takeSteamLoginCookie(cookies: Cookies, url: URL): string {
	const nonce = cookies.get(NAME) ?? '';
	cookies.delete(NAME, options(url));
	return nonce;
}
