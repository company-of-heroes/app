import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import { badRequest, internal, type AppError } from '../errors';
import { chunk, fromAsync, fromPb, sequence, type Task } from '../result';
import { Service } from './service';
import { contentTypeOf, readOverlayBundle } from '../domain/overlay';

/** The part of Cloudflare's R2 binding this service uses. */
export type OverlayBucket = {
	put(
		key: string,
		value: Uint8Array,
		options?: { httpMetadata?: { contentType?: string } }
	): Promise<unknown>;
	head(key: string): Promise<unknown | null>;
	list(options: {
		prefix: string;
		cursor?: string;
	}): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
	delete(keys: string[]): Promise<void>;
};

type OverlayRecord = {
	id: string;
	collectionId: string;
	user: string;
	bundle: string;
	version: string;
	updated: string;
};
/**
 * OBS overlays: users publish a zip of a static site; its files go to R2 under
 * `{userId}/` and the api-gateway serves /overlay/{userId}/… from there (falling
 * back to the default overlay). `user_overlays` keeps the zip and version.
 */
export class OverlaysService extends Service {
	private bucket(): Result<OverlayBucket, AppError> {
		const bucket = this.services.clients.overlays;
		return bucket ? ok(bucket) : err(internal('Overlay storage is not configured'));
	}

	/** Keys under `prefix`, following R2's pagination. */
	private listKeys(storage: OverlayBucket, prefix: string, cursor?: string): Task<string[]> {
		return fromAsync(storage.list({ prefix, cursor }), 'Could not list overlay files').andThen(
			(page) => {
				const keys = page.objects.map((object) => object.key);
				return page.truncated
					? this.listKeys(storage, prefix, page.cursor).map((rest) => [...keys, ...rest])
					: okAsync(keys);
			}
		);
	}

	/** Replaces the user's files in R2 with the bundle's. */
	private store(userId: string, zip: Uint8Array): Task<string> {
		let bundle: ReturnType<typeof readOverlayBundle>;
		try {
			bundle = readOverlayBundle(zip);
		} catch (error) {
			return errAsync(badRequest((error as Error).message));
		}

		const prefix = `${userId}/`;
		return this.bucket().asyncAndThen((storage) =>
			this.listKeys(storage, prefix)
				.map((keys) => keys.filter((key) => !bundle.files.has(key.slice(prefix.length))))
				.andThen((stale) =>
					sequence([...bundle.files], ([path, bytes]) =>
						fromAsync(
							storage.put(`${prefix}${path}`, bytes, {
								httpMetadata: { contentType: contentTypeOf(path) }
							}),
							'Could not store overlay files'
						)
					).andThen(() =>
						sequence(chunk(stale, 1000), (keys) =>
							fromAsync(storage.delete(keys), 'Could not remove old overlay files')
						)
					)
				)
				.map(() => bundle.version)
		);
	}

	private ownRecord(userId: string): Task<OverlayRecord | undefined> {
		return fromPb(
			this.pb.collection('user_overlays').getList<OverlayRecord>(1, 1, {
				filter: this.pb.filter('user = {:userId}', { userId }),
				skipTotal: true
			}),
			'Could not load overlay'
		).map((rows) => rows.items[0]);
	}

	/** Publishes a user's overlay bundle (zip). */
	publish(userId: string, file: File): Task<{ success: true; version: string; updatedAt: string }> {
		const overlays = this.pb.collection('user_overlays');
		return fromAsync(file.arrayBuffer(), 'Could not read the overlay bundle', 400)
			.andThen((buffer) => this.store(userId, new Uint8Array(buffer)))
			.andThen((version) =>
				this.ownRecord(userId).andThen((existing) => {
					const data = {
						user: userId,
						bundle: new File([file], 'bundle.zip', { type: 'application/zip' }),
						version
					};
					return fromPb(
						existing
							? overlays.update<OverlayRecord>(existing.id, data)
							: overlays.create<OverlayRecord>(data),
						'Could not save overlay'
					)
						.andThen((record) =>
							// A first overlay can unlock the "overlay published" reward.
							(existing
								? okAsync(undefined)
								: this.services.rewards.markDirty([{ id: userId }])
							).map(() => record)
						)
						.map((record) => ({ success: true as const, version, updatedAt: record.updated }));
				})
			);
	}

	/** Copies one stored bundle to R2 unless its files are there already; true when it copied. */
	private backfillOne(storage: OverlayBucket, row: OverlayRecord): Task<boolean> {
		return fromAsync(storage.head(`${row.user}/index.html`), 'Could not read R2').andThen(
			(present) => {
				if (present) {
					return okAsync(false);
				}

				return fromAsync(
					this.fetch(this.pb.files.getURL(row, row.bundle)),
					'Could not download the overlay bundle',
					502
				)
					.andThen((response) =>
						response.ok
							? fromAsync(
									response.arrayBuffer(),
									'Could not download the overlay bundle',
									502
								).andThen((buffer) => this.store(row.user, new Uint8Array(buffer)))
							: okAsync(undefined)
					)
					.orElse((error) => {
						console.warn('[overlays] backfill', row.user, error);
						return ok(undefined);
					})
					.map(() => true);
			}
		);
	}

	/** One-time move of bundles published before R2: copies overlays whose files are not in R2 yet. */
	backfill(page = 1, processed = 0): Task<{ processed: number; more: boolean }> {
		return this.bucket().asyncAndThen((storage) =>
			fromPb(
				this.pb
					.collection('user_overlays')
					.getList<OverlayRecord>(page, 50, { filter: "bundle != ''", sort: 'id' }),
				'Could not load overlays'
			).andThen((rows) =>
				this.backfillPage(storage, rows.items, processed).andThen((done) => {
					if (done >= 10) {
						return okAsync({ processed: done, more: true });
					}

					return page >= rows.totalPages
						? okAsync({ processed: done, more: false })
						: this.backfill(page + 1, done);
				})
			)
		);
	}

	/** Copies rows until ten bundles were copied in this run; returns the running count. */
	private backfillPage(
		storage: OverlayBucket,
		rows: OverlayRecord[],
		processed: number
	): Task<number> {
		const [row, ...rest] = rows;
		if (!row || processed >= 10) {
			return okAsync(processed);
		}

		return this.backfillOne(storage, row).andThen((copied) =>
			this.backfillPage(storage, rest, copied ? processed + 1 : processed)
		);
	}
}
