import { set, get, remove } from 'tauri-plugin-cache-api';

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
	signal?: AbortSignal;
};

/**
 * A helper to manage cached data.
 *
 * @template T - The type of data being cached.
 * @param {string} key - The unique key for the cached data.
 * @param {CacheOptions<T>} options - Configuration options for caching.
 * @returns {Promise<T>} - A promise that resolves to the data.
 */
function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw new DOMException('Aborted', 'AbortError');
	}
}

/** Values fetched this session; a repeat query skips the plugin round-trip. */
const memory = new Map<string, { value: unknown; expiresAt: number }>();
const MEMORY_MAX = 200;

/** `ttl` in seconds, like the plugin; without one the value never expires. */
function remember(key: string, value: unknown, ttl?: number) {
	memory.delete(key);
	memory.set(key, { value, expiresAt: ttl === undefined ? Infinity : Date.now() + ttl * 1000 });
	if (memory.size > MEMORY_MAX) {
		memory.delete(memory.keys().next().value!);
	}
}

function recall<T>(key: string): T | null {
	const hit = memory.get(key);
	if (!hit) {
		return null;
	}

	if (hit.expiresAt <= Date.now()) {
		memory.delete(key);
		return null;
	}

	return hit.value as T;
}

function forget(key: string): Promise<void> {
	memory.delete(key);
	return remove(key);
}

export async function useQuery<T>(key: string, options: CacheOptions<T>): Promise<T> {
	throwIfAborted(options.signal);

	if (options.ttl === 0) {
		return options.queryFn();
	}

	if (options.invalidate) {
		await forget(key);
	}

	let cached = recall<T>(key) ?? (await get<T>(key));

	if (typeof cached === 'string') {
		cached = tryDecodeBase64(cached);
	}

	if (cached) {
		options.invalidateFn?.(cached).then((isInvalid) => {
			if (isInvalid) {
				forget(key).catch((e) => console.warn(`Cache removal failed for key: ${key}`, e));
			}
		});

		throwIfAborted(options.signal);
		return cached;
	}

	const data = await options.queryFn();
	throwIfAborted(options.signal);

	const ttl = options.ttl ?? (options.invalidateFn ? undefined : 300);

	remember(key, data, ttl);
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
