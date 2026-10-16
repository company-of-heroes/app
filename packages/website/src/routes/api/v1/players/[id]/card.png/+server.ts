import { errAsync, ResultAsync } from 'neverthrow';
import { internal, notFound } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/** The supporter player card as a 1200×630 PNG (share image of `/card/{steamId}`); 404 for everyone else. */
export const GET = handle((event) =>
	event.locals.services.subscriptions.card(event.params.id ?? '').andThen((card) => {
		if (!card) {
			return errAsync(notFound('No player card'));
		}

		// Loaded on use: the build analyses this route in Node, which cannot import the wasm.
		const png = import('$lib/server/card/render').then(({ renderCardPng }) =>
			renderCardPng(card, { fetch: event.fetch })
		);
		return ResultAsync.fromPromise(png, (cause) => {
			console.error('[card] render failed', card.steamId, cause);
			return internal('Could not render the player card');
		}).map(
			(png) =>
				new Response(png, {
					headers: {
						'content-type': 'image/png',
						'cache-control': 'public, max-age=3600'
					}
				})
		);
	})
);
