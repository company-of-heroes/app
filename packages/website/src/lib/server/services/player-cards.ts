import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';
import { CARD_HEIGHT, CARD_WIDTH, type CardImageState } from '$lib/card/size';
import { cardHash, pngSize } from '../domain/card-png';
import { isValidSteamId } from '../domain/ratings';
import { badRequest, forbidden, internal, notFound, type AppError } from '../errors';
import { fromAsync, type Task } from '../result';
import type { OverlayBucket } from './overlays';
import { Service } from './service';

type StoredCard = { hash: string; updatedAt: string };

/** SHA-256 hex of the card data the PNG was drawn from. */
const HASH = /^[0-9a-f]{64}$/;

/** The R2 key of a card; only for a valid Steam ID, so no other key can be reached. */
function key(steamId: string): Result<string, AppError> {
	return isValidSteamId(steamId) ? ok(`cards/${steamId}.png`) : err(notFound('No player card'));
}

/**
 * Supporter player card PNGs. The owner's browser draws the card and uploads it; it is kept
 * in the overlays R2 bucket under `cards/{steamId}.png` (the api-gateway only serves
 * `{userId}/` keys from there) with the hash of the card data it shows and the uploader.
 */
export class PlayerCardsService extends Service {
	private bucket(): Result<OverlayBucket, AppError> {
		const bucket = this.services.clients.overlays;
		return bucket ? ok(bucket) : err(internal('Card storage is not configured'));
	}

	/** The bucket and the card's key. */
	private target(steamId: string): Result<{ storage: OverlayBucket; key: string }, AppError> {
		return key(steamId).andThen((cardKey) =>
			this.bucket().map((storage) => ({ storage, key: cardKey }))
		);
	}

	private stored(steamId: string): Task<StoredCard | null> {
		return this.target(steamId)
			.asyncAndThen(({ storage, key }) => fromAsync(storage.head(key), 'Could not read R2'))
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
		return this.target(steamId).asyncAndThen(({ storage, key }) =>
			fromAsync(storage.get(key), 'Could not read R2')
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

	/**
	 * Stores the owner's PNG of their card (see `authorize`) with the hash of the card data the
	 * browser drew it from (`state().hash` of the page it was drawn on) and the uploader.
	 */
	upload(userId: string, steamId: string, png: Uint8Array, hash: string): Task<StoredCard> {
		if (!HASH.test(hash)) {
			return errAsync(badRequest('Missing or invalid card hash.'));
		}

		const size = pngSize(png);
		if (!size) {
			return errAsync(badRequest('The card must be a PNG image.'));
		}

		if (size.width !== CARD_WIDTH || size.height !== CARD_HEIGHT) {
			return errAsync(badRequest(`The card must be ${CARD_WIDTH}×${CARD_HEIGHT} pixels.`));
		}

		const stored = { hash, updatedAt: new Date().toISOString() };
		return this.target(steamId)
			.asyncAndThen(({ storage, key }) =>
				fromAsync(
					storage.put(key, png, {
						httpMetadata: { contentType: 'image/png' },
						customMetadata: { ...stored, userId }
					}),
					'Could not store the card'
				)
			)
			.map(() => {
				console.info('[card] uploaded', { userId, steamId, bytes: png.byteLength });
				return stored;
			});
	}

	/** Staff: removes a stored card PNG (the GET serves the fallback until the next upload). */
	remove(staffId: string, steamId: string): Task<void> {
		return this.target(steamId)
			.asyncAndThen(({ storage, key }) =>
				fromAsync(storage.delete([key]), 'Could not remove the card')
			)
			.map(() => {
				console.info('[card] removed by staff', { staffId, steamId });
			});
	}
}
