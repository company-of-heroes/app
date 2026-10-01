import { limitFileDownload, type FilesEnv } from './files.ts';
import { OVERLAY_HOST, serveOverlay, type OverlayEnv } from './overlay.ts';
import { rewrite, rewritesPath } from './routes.ts';

type Env = OverlayEnv & FilesEnv & { WEBSITE: Fetcher };

/** PocketBase's fixed `_superusers` collection id. */
const SUPERUSERS_COLLECTION_ID = 'pbc_3142635823';

/**
 * Superuser calls (the website's own services) go straight to PocketBase, never to
 * the website's user-facing compat routes. The token is not verified here: PocketBase
 * does that, so a forged one only reaches PocketBase as it would without the gateway.
 */
function isSuperuserRequest(request: Request): boolean {
	const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	const payload = token.split('.')[1];
	if (!payload) {
		return false;
	}

	try {
		const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
		return claims?.collectionId === SUPERUSERS_COLLECTION_ID;
	} catch {
		return false;
	}
}

/** PocketBase answered every origin; rewritten paths keep that for browser clients. */
function cors(request: Request): Record<string, string> {
	return {
		'access-control-allow-origin': '*',
		'access-control-allow-methods': 'GET, HEAD, PUT, PATCH, POST, DELETE',
		'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '*',
		'access-control-max-age': '86400'
	};
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const overlay = await serveOverlay(request, env);
		if (overlay) {
			return overlay;
		}

		const url = new URL(request.url);
		if (url.hostname === OVERLAY_HOST) {
			return new Response('Not found', { status: 404 });
		}

		const limited = await limitFileDownload(request, env);
		if (limited) {
			return limited;
		}

		if (request.method === 'OPTIONS' && rewritesPath(url.pathname)) {
			return new Response(null, { status: 204, headers: cors(request) });
		}

		const v1Path = isSuperuserRequest(request) ? null : rewrite(request.method, url.pathname);
		if (!v1Path) {
			return fetch(request); // PocketBase origin
		}

		const target = new URL(`${v1Path}${url.search}`, 'https://coh1stats.com');
		const headers = new Headers(request.headers);
		headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') ?? '');
		const body = request.method === 'GET' || request.method === 'HEAD' ? null : request.body;
		// Redirects (e.g. to Steam's login) go back to the browser, not followed here.
		const response = await env.WEBSITE.fetch(
			new Request(target, { method: request.method, headers, body, redirect: 'manual' })
		);
		const withCors = new Response(response.body, response);
		for (const [name, value] of Object.entries(cors(request))) {
			withCors.headers.set(name, value);
		}
		return withCors;
	}
} satisfies ExportedHandler<Env>;
