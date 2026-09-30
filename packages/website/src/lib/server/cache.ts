import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { internal, type AppError } from './errors';
import type { Task } from './result';

type CacheEntry<T> = { ok: true; value: T } | { ok: false; error: AppError };

function defaultCache(): Cache | undefined {
	return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

const cacheRequest = (key: string) =>
	new Request(`https://cache.internal/${encodeURIComponent(key)}`);

/**
 * Read-through cache on the Cloudflare Cache API (per data center). Falls back to
 * calling `load` directly where `caches` is unavailable (vite dev). Only `ok` values
 * are stored; an error is returned as-is.
 */
export function cached<T>(key: string, ttlSeconds: number, load: () => Task<T>): Task<T> {
	const cache = defaultCache();
	if (!cache) {
		return load();
	}

	const request = cacheRequest(key);
	return ResultAsync.fromSafePromise(
		(async (): Promise<CacheEntry<T>> => {
			const hit = await cache.match(request).catch(() => undefined);
			if (hit) {
				return { ok: true, value: (await hit.json()) as T };
			}

			const loaded = await load();
			if (loaded.isErr()) {
				return { ok: false, error: loaded.error };
			}

			await cache
				.put(
					request,
					new Response(JSON.stringify(loaded.value), {
						headers: {
							'content-type': 'application/json',
							'cache-control': `max-age=${ttlSeconds}`
						}
					})
				)
				.catch((error) => console.error(`[cache] ${key}`, error));
			return { ok: true, value: loaded.value };
		})().catch((error): CacheEntry<T> => {
			console.error(`[cache] ${key}`, error);
			return { ok: false, error: internal() };
		})
	).andThen((entry) => (entry.ok ? okAsync(entry.value) : errAsync(entry.error)));
}

/** Drops a cached value in this data center (others expire by their TTL). */
export function uncache(key: string): Task<void> {
	return ResultAsync.fromSafePromise(
		(async () => {
			await defaultCache()
				?.delete(cacheRequest(key))
				.catch(() => false);
		})()
	);
}
