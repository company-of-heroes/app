import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { boot, syncLocalsUser } from './boot';
import {
	DEFAULT_LOCALE,
	parseLocaleFromPath,
	translate,
	type AppLocale
} from '@company-of-heroes/i18n';

function withMutableHeaders(response: Response, mutate: (headers: Headers) => void): Response {
	try {
		mutate(response.headers);
		return response;
	} catch {
		const copy = new Response(response.body, response);
		mutate(copy.headers);
		return copy;
	}
}

function localeFromUrl(pathname: string): { locale: AppLocale; englishPrefix: boolean } {
	const parsed = parseLocaleFromPath(pathname);
	return {
		locale: parsed.locale,
		englishPrefix: parsed.prefixed && parsed.locale === DEFAULT_LOCALE
	};
}

function isCacheableApiPath(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

export const handle: Handle = async ({ event, resolve }) => {
	const { locale, englishPrefix } = localeFromUrl(event.url.pathname);
	if (englishPrefix) {
		const parsed = parseLocaleFromPath(event.url.pathname);
		redirect(301, `${parsed.path}${event.url.search}`);
	}

	event.locals.locale = locale;
	event.locals.t = (key, params) => translate(locale, key, params);

	boot(event);
	const pocketbase = event.locals.pocketbase;
	const hadAuthCookie = event.request.headers.get('cookie')?.includes('pb_auth') ?? false;
	if (hadAuthCookie) {
		try {
			if (pocketbase.authStore.isValid) {
				await pocketbase.collection('users').authRefresh();
			}
		} catch {
			pocketbase.authStore.clear();
		}
	}

	syncLocalsUser(event);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replaceAll('%lang%', locale)
	});

	const hasAuthToken = Boolean(pocketbase.authStore.token);
	const authed = hadAuthCookie || hasAuthToken || pocketbase.authStore.isValid;
	// Layout always embeds `user`. Cloudflare shared cache does not reliably honor
	// Vary: Cookie, so auth-aware HTML/data must never be stored at the edge —
	// otherwise login/logout only shows up after a hard refresh.
	const allowSharedCache = isCacheableApiPath(event.url.pathname);

	return withMutableHeaders(response, (headers) => {
		const vary = headers.get('vary');
		if (!vary?.toLowerCase().includes('cookie')) {
			headers.append('Vary', 'Cookie');
		}

		if (!allowSharedCache || authed) {
			headers.set('cache-control', 'private, no-store');
		}

		// Always re-export after login (set) or logout/clear (expire). Skipping
		// export when the store is empty left pb_auth in the browser on logout.
		if (hasAuthToken || hadAuthCookie) {
			headers.append(
				'set-cookie',
				pocketbase.authStore.exportToCookie({
					httpOnly: true,
					secure: event.url.protocol === 'https:',
					sameSite: 'lax',
					path: '/'
				})
			);
		}
	});
};
