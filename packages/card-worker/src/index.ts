import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';
import { renderCardPng } from './render';

/**
 * POST the card data (`PlayerCardData` JSON) → the 1200×630 PNG. Only the website calls this,
 * through its CARD_RENDERER service binding; the website checks the supporter, caches the
 * image and rate-limits renders. The worker has no public URL.
 */
function isCard(value: unknown): value is PlayerCardData {
	const card = value as Partial<PlayerCardData> | null;
	return Boolean(
		card &&
		typeof card.steamId === 'string' &&
		typeof card.alias === 'string' &&
		Array.isArray(card.factions) &&
		Array.isArray(card.ribbons) &&
		Array.isArray(card.labels)
	);
}

export default {
	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const card: unknown = await request.json().catch(() => null);
		if (!isCard(card)) {
			return new Response('Invalid card', { status: 400 });
		}

		try {
			return new Response(await renderCardPng(card), {
				headers: { 'content-type': 'image/png' }
			});
		} catch (error) {
			console.error('[card] render failed', card.steamId, error);
			return new Response('Render failed', { status: 500 });
		}
	}
} satisfies ExportedHandler;
