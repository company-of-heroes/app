import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';
import { CARD_HEIGHT, CARD_WIDTH, type CardImageState } from '$lib/card/size';
import { cardHash, pngSize } from '../domain/card-png';
import { badRequest, forbidden, internal, notFound, type AppError } from '../errors';
import { fromAsync, type Task } from '../result';
import type { OverlayBucket } from './overlays';
import { Service } from './service';

type StoredCard = { hash: string; updatedAt: string };

const key = (steamId: string) => `cards/${steamId}.png`;

/**
 * Supporter player card PNGs. The owner's browser draws the card and uploads it; it is kept
 * in the overlays R2 bucket under `cards/{steamId}.png` (the api-gateway only serves
 * `{userId}/` keys from there) with the hash of the card data it shows.
 */
export class PlayerCardsService extends Service {
	private bucket(): Result<OverlayBucket, AppError> {
		const bucket = this.services.clients.overlays;
		return bucket ? ok(bucket) : err(internal('Card storage is not configured'));
	}

	private stored(steamId: string): Task<StoredCard | null> {
		return this.bucket()
			.asyncAndThen((storage) => fromAsync(storage.head(key(steamId)), 'Could not read R2'))
			.map((object) => {
				const meta = object?.customMetadata;
				return meta?.hash && meta.updatedAt ? { hash: meta.hash, updatedAt: meta.updatedAt } : null;
			});
	}

	/** The owner's view: the current data's hash and what is stored, to decide on a new upload. */
	state(card: PlayerCardData): Task<CardImageState> {
		return fromAsync(cardHash(card), 'Could not hash the card').andThen((hash) =>
			this.stored(card.steamId)
				.orElse(() => okAsync(null))
				.map((stored) => ({ hash, stored }))
		);
	}

	/** The stored PNG of a supporter's Steam ID; null before the owner's first upload. */
	image(steamId: string): Task<{ body: ReadableStream; size: number } | null> {
		return this.bucket().asyncAndThen((storage) =>
			fromAsync(storage.get(key(steamId)), 'Could not read R2')
		);
	}

	/** Only the signed-in account that alone owns the Steam ID may upload, while it supports. */
	authorize(userId: string, steamId: string): Task<void> {
		return this.services.subscriptions.cardOwner(steamId).andThen((owner) => {
			if (!owner) {
				return errAsync(notFound('No player card'));
			}

			return owner === userId
				? okAsync(undefined)
				: errAsync(forbidden('Only the owner can update this card.'));
		});
	}

	/** Stores the owner's PNG of their card (see `authorize`) with the hash of the data as it is now. */
	upload(steamId: string, png: Uint8Array): Task<StoredCard> {
		const size = pngSize(png);
		if (!size) {
			return errAsync(badRequest('The card must be a PNG image.'));
		}

		if (size.width !== CARD_WIDTH || size.height !== CARD_HEIGHT) {
			return errAsync(badRequest(`The card must be ${CARD_WIDTH}×${CARD_HEIGHT} pixels.`));
		}

		return this.services.subscriptions
			.card(steamId)
			.andThen((card) =>
				card
					? fromAsync(cardHash(card), 'Could not hash the card')
					: errAsync(notFound('No player card'))
			)
			.andThen((hash) => {
				const stored = { hash, updatedAt: new Date().toISOString() };
				return this.bucket()
					.asyncAndThen((storage) =>
						fromAsync(
							storage.put(key(steamId), png, {
								httpMetadata: { contentType: 'image/png' },
								customMetadata: stored
							}),
							'Could not store the card'
						)
					)
					.map(() => stored);
			});
	}
}
