import { json, redirect, type RequestEvent } from '@sveltejs/kit';
import fallbackPng from '$lib/server/card/fallback.png?inline';
import type { PlayerCardData } from '$lib/server/services/subscriptions';
import type { RequestHandler } from './$types';

/** A rendered card is kept this long (edge cache and browsers). */
const CARD_MAX_AGE = 3600;
/** "Not a supporter" is kept shorter, so a new supporter's card shows up soon. */
const MISSING_MAX_AGE = 300;
/** The generic image after a failure: retried soon. */
const FALLBACK_MAX_AGE = 60;
/** The card worker gets this long before the fallback PNG is served. */
const RENDER_TIMEOUT_MS = 8000;

let fallbackBytes: Uint8Array | null = null;

/** The generic coh1stats card, served when loading the data or rendering fails. */
function fallback(): Response {
	if (!fallbackBytes) {
		const binary = atob(fallbackPng.slice(fallbackPng.indexOf(',') + 1));
		fallbackBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	}

	return new Response(fallbackBytes.slice(), {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${FALLBACK_MAX_AGE}`
		}
	});
}

function clientIp(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		return '';
	}
}

/** The PNG from the card worker (service binding); null when it is missing or fails. */
async function render(event: RequestEvent, card: PlayerCardData): Promise<Uint8Array | null> {
	const renderer = event.platform?.env?.CARD_RENDERER;
	if (!renderer) {
		return null;
	}

	try {
		const response = await renderer.fetch('https://card-worker/render', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(card),
			// A hung renderer falls back to the static PNG.
			signal: AbortSignal.timeout(RENDER_TIMEOUT_MS)
		});
		if (!response.ok || response.headers.get('content-type') !== 'image/png') {
			console.error('[card] renderer answered', response.status, await response.text());
			return null;
		}

		return new Uint8Array(await response.arrayBuffer());
	} catch (error) {
		console.error('[card] renderer unreachable', error);
		return null;
	}
}

/**
 * The supporter player card as a 1200×630 PNG (share image of `/card/{steamId}`); 404 for
 * everyone else. One cache entry per card, keyed by the canonical URL whatever the request's
 * query or cache headers; only a cache miss loads data and renders, at most 10 a minute per IP.
 */
export const GET: RequestHandler = async (event) => {
	const { url, platform, params, locals } = event;
	if (url.search) {
		redirect(301, url.pathname);
	}

	const cache = platform?.caches?.default;
	const key = new Request(`${url.origin}${url.pathname}`);
	const hit = await cache?.match(key);
	if (hit) {
		return hit;
	}

	const limiter = platform?.env?.CARD_LIMITER;
	if (limiter && !(await limiter.limit({ key: `card:${clientIp(event) || 'unknown'}` })).success) {
		return json(
			{ message: 'Too many player cards. Try again in a moment.' },
			{ status: 429, headers: { 'retry-after': '60' } }
		);
	}

	const keep = (response: Response): Response => {
		if (cache) {
			platform?.context?.waitUntil(cache.put(key, response.clone()));
		}

		return response;
	};
	const card = await locals.services.subscriptions.card(params.id);
	if (card.isErr()) {
		console.error('[card] could not load', params.id, card.error.message);
		return fallback();
	}

	if (!card.value) {
		return keep(
			json(
				{ message: 'No player card' },
				{ status: 404, headers: { 'cache-control': `public, max-age=${MISSING_MAX_AGE}` } }
			)
		);
	}

	const png = await render(event, card.value);
	if (!png) {
		return fallback();
	}

	return keep(
		new Response(png, {
			headers: {
				'content-type': 'image/png',
				'cache-control': `public, max-age=${CARD_MAX_AGE}`
			}
		})
	);
};
