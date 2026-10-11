export interface TtlCache<T> {
	/** Returns the cached value while fresh, otherwise calls `load` and caches the result. */
	getOrLoad(key: string, load: () => T): T;
	/** Returns the cached value, including expired ones (stale-while-revalidate). */
	peek(key: string): T | undefined;
	/** Drops one key, or the whole cache when no key is given. */
	invalidate(key?: string): void;
}

type CacheEntry<T> = { value: T; expiresAt: number };

const DEFAULT_MAX = 500;

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	);
}

function isErrResult(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { isErr?: unknown }).isErr === 'function' &&
		(value as { isErr: () => boolean }).isErr()
	);
}

/**
 * Small in-memory TTL cache. Only resolved values stay: a PromiseLike (including a
 * neverthrow `ResultAsync`) that rejects or resolves to an `Err` is dropped again.
 * The oldest entry is evicted first once `max` (default 500) is reached.
 */
export function createTtlCache<T>(options: { ttlMs: number; max?: number }): TtlCache<T> {
	const { ttlMs, max = DEFAULT_MAX } = options;
	const entries = new Map<string, CacheEntry<T>>();

	function drop(key: string, entry: CacheEntry<T>) {
		if (entries.get(key) === entry) {
			entries.delete(key);
		}
	}

	return {
		getOrLoad(key, load) {
			const hit = entries.get(key);
			if (hit && hit.expiresAt > Date.now()) {
				return hit.value;
			}

			const value = load();
			const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
			entries.delete(key);
			entries.set(key, entry);
			while (entries.size > max) {
				const oldest = entries.keys().next().value;
				if (oldest === undefined) {
					break;
				}

				entries.delete(oldest);
			}

			if (isThenable(value)) {
				value.then(
					(result) => {
						if (isErrResult(result)) {
							drop(key, entry);
						}
					},
					() => drop(key, entry)
				);
			}

			return value;
		},
		peek(key) {
			return entries.get(key)?.value;
		},
		invalidate(key) {
			if (key === undefined) {
				entries.clear();
				return;
			}

			entries.delete(key);
		}
	};
}
