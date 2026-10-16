import { json, redirect } from '@sveltejs/kit';
import { errAsync, okAsync } from 'neverthrow';
import fallbackPng from '$lib/server/card/fallback.png?inline';
import { CARD_MAX_BYTES, readCapped } from '$lib/server/domain/card-png';
import { badRequest, rateLimited } from '$lib/server/errors';
import { handle, requireStaff, requireUser } from '$lib/server/http';
import { fromAsync, type Task } from '$lib/server/result';
import type { RequestHandler } from './$types';

/** A stored card is kept this long (edge cache and browsers). */
const CARD_MAX_AGE = 3600;
/** "Not a supporter" is kept shorter, so a new supporter's card shows up soon. */
const MISSING_MAX_AGE = 300;
/** The generic image before the first upload or after a failure: retried soon. */
const FALLBACK_MAX_AGE = 60;

let fallbackBytes: Uint8Array | null = null;

/** The generic coh1stats card, served before the owner's first upload or when loading fails. */
function fallback(): Response {
	if (!fallbackBytes) {
		const binary = atob(fallbackPng.slice(fallbackPng.indexOf(',') + 1));
		fallbackBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	}

	return new Response(fallbackBytes.slice(), {
		headers: {
			'content-type': 'image/png',
			'x-content-type-options': 'nosniff',
			'cache-control': `public, max-age=${FALLBACK_MAX_AGE}`
		}
	});
}

/** The edge cache key of a card: its canonical URL, whatever the request's query or headers. */
function cacheKey(url: URL): Request {
	return new Request(`${url.origin}${url.pathname}`);
}

/**
 * The supporter player card as a 1200×630 PNG (share image of `/card/{steamId}`); 404 for
 * everyone else. The owner's browser draws it (POST below); this only serves the stored
 * image. One cache entry per card, keyed by the canonical URL.
 */
export const GET: RequestHandler = async ({ url, platform, params, locals }) => {
	if (url.search) {
		redirect(301, url.pathname);
	}

	const cache = platform?.caches?.default;
	const key = cacheKey(url);
	const hit = await cache?.match(key);
	if (hit) {
		return hit;
	}

	const keep = (response: Response): Response => {
		if (cache) {
			platform?.context?.waitUntil(cache.put(key, response.clone()));
		}

		return response;
	};
	const owner = await locals.services.subscriptions.cardOwner(params.id);
	if (owner.isErr()) {
		console.error('[card] could not load', params.id, owner.error.message);
		return fallback();
	}

	if (!owner.value) {
		return keep(
			json(
				{ message: 'No player card' },
				{ status: 404, headers: { 'cache-control': `public, max-age=${MISSING_MAX_AGE}` } }
			)
		);
	}

	const image = await locals.services.playerCards.image(params.id);
	if (image.isErr() || !image.value) {
		return fallback();
	}

	return keep(
		new Response(image.value.body, {
			headers: {
				'content-type': 'image/png',
				'content-length': String(image.value.size),
				// Owner-uploaded bytes: never sniffed or run as anything but an image.
				'x-content-type-options': 'nosniff',
				'content-security-policy': "default-src 'none'; sandbox",
				'cache-control': `public, max-age=${CARD_MAX_AGE}`
			}
		})
	);
};

/** Drops this data centre's cached copy of the card (other colos keep theirs up to an hour). */
function purge(platform: App.Platform | undefined, url: URL): Task<void> {
	const cache = platform?.caches?.default;
	if (!cache) {
		return okAsync(undefined);
	}

	return fromAsync(cache.delete(cacheKey(url)), 'Could not purge the card').map(() => undefined);
}

/**
 * The owner uploads the PNG their browser drew of their card (body: `image/png`, 1200×630,
 * at most 1 MB; `x-card-hash`: the hash of the card data it was drawn from, from the card
 * page). Rate-limited per account; drops this colo's cached copy afterwards.
 */
export const POST: RequestHandler = handle((event) => {
	const { request, platform, params, locals, url } = event;
	return requireUser(event)
		.asyncAndThen((user) => {
			const limiter = platform?.env?.CARD_LIMITER;
			if (!limiter) {
				return okAsync(user);
			}

			return fromAsync(limiter.limit({ key: `card:${user.id}` }), 'Rate limit failed').andThen(
				(outcome) =>
					outcome.success
						? okAsync(user)
						: errAsync(rateLimited('Too many card uploads. Try again in a minute.', 60))
			);
		})
		.andThen((user) =>
			locals.services.playerCards.authorize(user.id, params.id ?? '').map(() => user)
		)
		.andThen((user) =>
			// Only `image/png`: a non-simple type forces the CORS preflight that keeps cookie
			// POSTs from other sites out (the API allows `*` without credentials). Do not loosen.
			request.headers.get('content-type')?.split(';')[0].trim() === 'image/png'
				? fromAsync(readCapped(request, CARD_MAX_BYTES), 'Could not read the card', 400).map(
						(png) => ({ user, png })
					)
				: errAsync(badRequest('The card must be a PNG image.'))
		)
		.andThen(({ user, png }) =>
			png
				? locals.services.playerCards.upload(
						user.id,
						params.id ?? '',
						png,
						request.headers.get('x-card-hash') ?? ''
					)
				: errAsync(badRequest('The card image is larger than 1 MB.'))
		)
		.andThen((stored) => purge(platform, url).map(() => stored));
});

/** Staff remove a stored card PNG (e.g. an abusive upload); the fallback image shows instead. */
export const DELETE: RequestHandler = handle((event) =>
	requireStaff(event)
		.asyncAndThen((staff) =>
			event.locals.services.playerCards.remove(staff.id, event.params.id ?? '')
		)
		.andThen(() => purge(event.platform, event.url))
		.map(() => new Response(null, { status: 204 }))
);
