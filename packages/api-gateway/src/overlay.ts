/**
 * OBS overlays at /overlay/{userId}/…: the user's published files from R2, else
 * the default overlay (static assets of this Worker). index.html gets a <base>
 * for the user path and points the overlay at this origin's PocketBase API.
 */
export type OverlayEnv = { OVERLAYS: R2Bucket; DEFAULT_OVERLAY: Fetcher };

const USER_ID = /^[a-z0-9]{15}$/;

function notFound(): Response {
	return new Response('Not found', { status: 404 });
}

function withBase(html: string, userId: string): string {
	let out = html;
	if (!out.includes('<base ')) {
		out = out.replace('<head>', `<head>\n\t\t<base href="/overlay/${userId}/" />`);
	}

	if (!out.includes('__OPP_PB_URL')) {
		out = out.replace(
			'<head>',
			'<head>\n\t\t<script>window.__OPP_PB_URL=location.origin;</script>'
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

	const isHtml = path.endsWith('.html');
	const headers = {
		'content-type': contentType,
		'cache-control': isHtml
			? 'no-cache, no-store, must-revalidate'
			: 'public, max-age=31536000, immutable'
	};
	if (path === 'index.html') {
		return new Response(withBase(await new Response(body).text(), userId), { headers });
	}

	return new Response(body, { headers });
}
