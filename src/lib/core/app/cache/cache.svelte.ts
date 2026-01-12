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
export async function useQuery<T extends unknown>(
	key: string,
	options: CacheOptions<T>
): Promise<T> {
	if (options.invalidate) {
		await remove(key);
	}

	const isCached = await has(key);

	if (isCached) {
		let current = await get<T>(key);

		if (typeof current === 'string') {
			try {
				const decoded = atob(current);

				if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
					current = JSON.parse(decoded);
				}
			} catch (e) {}
		}

		options.invalidateFn?.(current).then((isInvalid) => {
			if (isInvalid) {
				remove(key);
			}
		});

		if (current) {
			return current;
		}
	}

	const data = await options.queryFn();

	set(key, data, { ttl: options.ttl ?? (options.invalidateFn ? undefined : 300) }).catch((e) =>
		console.warn('Background cache write failed', e)
	);

	return data;
}
