import { set, get, has, remove } from 'tauri-plugin-cache-api';

/**
 * Options for caching data.
 *
 * @template T - The type of data being cached.
 * @property {() => Promise<T>} queryFn - The function to fetch the data.
 * @property {() => Promise<boolean>} [invalidateFn] - Optional function to determine if the cache should be invalidated.
 * @property {boolean} [invalidate] - Optional flag to force invalidate the cache.
 * @property {number} [ttl] - Time-to-live for the cached data in seconds.
 */
export type CacheOptions<T> = {
	queryFn: () => Promise<T>;
	invalidateFn?: (value: T | null) => Promise<boolean>;
	invalidate?: boolean;
	ttl?: number;
};

/**
 * A helper to manage cached data.
 *
 * @template T - The type of data being cached.
 * @param {string} key - The unique key for the cached data.
 * @param {CacheOptions<T>} options - Configuration options for caching.
 * @returns {Promise<T>} - A promise that resolves to the data.
 */
export async function useQuery<T>(key: string, options: CacheOptions<T>): Promise<T> {
	if (options.invalidate) {
		await remove(key);
	}

	if (await has(key)) {
		let cached = await get<T>(key);

		if (typeof cached === 'string') {
			cached = tryDecodeBase64(cached);
		}

		options.invalidateFn?.(cached).then((isInvalid) => {
			if (isInvalid) {
				remove(key).catch((e) => console.warn(`Cache removal failed for key: ${key}`, e));
			}
		});

		if (cached) {
			return cached;
		}
	}

	const data = await options.queryFn();
	const ttl = options.ttl ?? (options.invalidateFn ? undefined : 300);

	set(key, data, { ttl }).catch((e) => console.warn(`Cache write failed for key: ${key}`, e));

	return data;
}

function tryDecodeBase64(value: string): any {
	try {
		const decoded = atob(value);

		if (decoded.trim().match(/^[\[{]/)) {
			return JSON.parse(decoded);
		} else {
			return null;
		}
	} catch {
		return null;
	}
}
