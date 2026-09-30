import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveOverlay, type OverlayEnv } from './overlay.ts';

const USER = 'abcdefghij12345';

function env(files: Record<string, string>): OverlayEnv {
	const OVERLAYS = {
		async get(key: string) {
			return key in files
				? {
						body: new Response(files[key]).body,
						httpMetadata: { contentType: 'text/html; charset=utf-8' }
					}
				: null;
		}
	} as unknown as R2Bucket;
	const DEFAULT_OVERLAY = {
		async fetch(request: Request) {
			const path = new URL(request.url).pathname.slice(1);
			return path === 'index.html'
				? new Response('<html><head></head><body>default</body></html>', {
						headers: { 'content-type': 'text/html' }
					})
				: new Response('', { status: 404 });
		}
	} as unknown as Fetcher;
	return { OVERLAYS, DEFAULT_OVERLAY };
}

const get = (path: string, files: Record<string, string> = {}) =>
	serveOverlay(new Request(`https://api.coh1stats.com${path}`), env(files));

test('other paths are not overlays', async () => {
	assert.equal(await get('/api/leaderboard/4'), null);
});

test('redirects to the trailing slash and rejects bad ids', async () => {
	assert.equal((await get(`/overlay/${USER}`))?.status, 301);
	assert.equal((await get('/overlay/NOT-AN-ID/'))?.status, 404);
	assert.equal((await get(`/overlay/${USER}/../x`))?.status, 404);
});

test('serves the published overlay with a base href', async () => {
	const response = await get(`/overlay/${USER}/`, {
		[`${USER}/index.html`]: '<html><head></head><body>mine</body></html>'
	});
	const html = await response!.text();
	assert.match(html, /mine/);
	assert.match(html, new RegExp(`<base href="/overlay/${USER}/" />`));
	assert.match(html, /__OPP_PB_URL/);
	assert.equal(response!.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
});

test('falls back to the default overlay', async () => {
	const html = await (await get(`/overlay/${USER}/index.html`))!.text();
	assert.match(html, /default/);
	assert.equal((await get(`/overlay/${USER}/missing.js`))?.status, 404);
});
