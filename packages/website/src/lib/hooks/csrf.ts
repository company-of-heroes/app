/**
 * SvelteKit's cross-site form check (`csrf.checkOrigin`), moved here so payment webhooks can
 * pass: Mollie posts `id=tr_…` as a form without an `Origin` header. Those routes trust only
 * what they read back from the provider.
 */

/** The desktop app's webview uploads replays and overlays (multipart) with a token header. */
const TRUSTED_ORIGINS = ['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'];

/** Server-to-server notifications; no browser session is involved. */
const WEBHOOK_PATHS = ['/api/mollie/webhook'];

const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function isFormContentType(request: Request): boolean {
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	return FORM_TYPES.includes(type);
}

/** True for a form submission from another site (403), exactly as SvelteKit would refuse it. */
export function isCrossSiteForm(request: Request, url: URL): boolean {
	if (!UNSAFE_METHODS.includes(request.method) || !isFormContentType(request)) {
		return false;
	}

	if (WEBHOOK_PATHS.includes(url.pathname)) {
		return false;
	}

	const origin = request.headers.get('origin');
	return origin !== url.origin && (!origin || !TRUSTED_ORIGINS.includes(origin));
}
