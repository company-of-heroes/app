/**
 * OBS overlays at /overlay/{userId}/…: the user's published files from R2, else
 * the default overlay (static assets of this Worker). index.html gets a <base>
 * for the user path and points the overlay at the PocketBase API.
 *
 * Overlays are user code, so they live on their own host: on the API host they could
 * read the PocketBase admin UI's token (same origin). The API host redirects there.
 */
export type OverlayEnv = { OVERLAYS: R2Bucket; DEFAULT_OVERLAY: Fetcher };

export const OVERLAY_HOST = 'overlay.coh1stats.com';
const API_HOST = 'api.coh1stats.com';

const USER_ID = /^[a-z0-9]{15}$/;

function notFound(): Response {
	return new Response('Not found', { status: 404 });
}

function withBase(html: string, userId: string, apiOrigin: string): string {
	let out = html;
	if (!out.includes('<base ')) {
		out = out.replace('<head>', `<head>\n\t\t<base href="/overlay/${userId}/" />`);
	}

	if (!out.includes('__OPP_PB_URL')) {
		out = out.replace(
			'<head>',
			`<head>\n\t\t<script>window.__OPP_PB_URL=${JSON.stringify(apiOrigin)};</script>`
		);
	}

	return out;
}

/** Returns null when the path is not an overlay path. */
export async function serveOverlay(request: Request, env: OverlayEnv): Promise<Response | null> {
	const url = new URL(request.url);
	const match = url.pathname.match(/^\/overlay\/([^/]+)(\/.*)?$/);
	if (!match || (request.method !== 'GET' && request.method !== 'HEAD')) {
		return null;
	}

	if (url.hostname === API_HOST) {
		return Response.redirect(`https://${OVERLAY_HOST}${url.pathname}${url.search}`, 301);
	}

	const [, userId, rest] = match;
	if (!USER_ID.test(userId)) {
		return notFound();
	}

	if (!rest) {
		return Response.redirect(`${url.origin}/overlay/${userId}/`, 301);
	}

	const path = decodeURIComponent(rest.slice(1)) || 'index.html';
	if (path.split('/').includes('..')) {
		return notFound();
	}

	const object = await env.OVERLAYS.get(`${userId}/${path}`);
	let body: ReadableStream | null;
	let contentType: string;
	if (object) {
		body = object.body;
		contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
	} else {
		const fallback = await env.DEFAULT_OVERLAY.fetch(new Request(`https://assets.local/${path}`));
		if (!fallback.ok) {
			return notFound();
		}

		body = fallback.body;
		contentType = fallback.headers.get('content-type') ?? 'application/octet-stream';
	}

	// Published files keep their names between versions; only the default overlay's
	// build assets are content-hashed.
	const headers = {
		'content-type': contentType,
		'cache-control':
			path.endsWith('.html') || object
				? 'no-cache, no-store, must-revalidate'
				: 'public, max-age=31536000, immutable'
	};
	if (path === 'index.html') {
		const apiOrigin = url.hostname === OVERLAY_HOST ? `https://${API_HOST}` : url.origin;
		return new Response(withBase(await new Response(body).text(), userId, apiOrigin), {
			headers
		});
	}

	return new Response(body, { headers });
}
