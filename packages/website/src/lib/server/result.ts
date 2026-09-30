import { ClientResponseError } from 'pocketbase';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { fromClientError } from '@company-of-heroes/api';
import { upstream, type AppError } from './errors';

export type Task<T> = ResultAsync<T, AppError>;

/** Failures a caller cannot act on (network, 5xx, bugs) are logged; `handle()` only sees the mapped error. */
function logUnexpected(error: unknown, fallback: string) {
	if (!(error instanceof ClientResponseError) || error.status === 0 || error.status >= 500) {
		console.error(`[services] ${fallback}`, error);
	}
}

/** A PocketBase call as a Result; its error becomes an `AppError` (404 → `fallback`, 400 → the field message). */
export function fromPb<T>(
	promise: Promise<T>,
	fallback = 'Something went wrong. Please try again later.'
): Task<T> {
	return ResultAsync.fromPromise(promise, (error) => {
		logUnexpected(error, fallback);
		return fromClientError(error, fallback);
	});
}

/** Like `fromPb`, but a 404 yields `null`. */
export function pbMaybe<T>(promise: Promise<T>, fallback?: string): Task<T | null> {
	return fromPb(
		promise.catch((error) => {
			if (error instanceof ClientResponseError && error.status === 404) {
				return null;
			}

			throw error;
		}),
		fallback
	);
}

/** Any other promise (fetch, crypto, R2); a rejection becomes a logged 500 or 502. */
export function fromAsync<T>(promise: Promise<T>, fallback: string, status = 500): Task<T> {
	return ResultAsync.fromPromise(promise, (error) => {
		console.error(`[services] ${fallback}`, error);
		return { status, message: fallback };
	});
}

/** Runs the tasks in order (not in parallel), collecting their values. */
export function sequence<T, R>(
	items: readonly T[],
	fn: (item: T, index: number) => Task<R>
): Task<R[]> {
	return items.reduce<Task<R[]>>(
		(done, item, index) =>
			done.andThen((values) => fn(item, index).map((value) => [...values, value])),
		okAsync([])
	);
}

/** Runs the tasks in parallel; the first error wins. */
export function all<R>(tasks: Task<R>[]): Task<R[]> {
	return ResultAsync.combine(tasks);
}

/**
 * A JSON request to an outside API: unreachable, a non-2xx status or a body that is
 * not JSON all become a 502 named after `label`.
 */
export function fetchJson<T>(
	fetchFn: typeof globalThis.fetch,
	input: string,
	init: RequestInit | undefined,
	label: string
): Task<T> {
	return fromAsync(fetchFn(input, init), `${label} unreachable`, 502).andThen((response) =>
		response.ok
			? fromAsync(response.json() as Promise<T>, `${label} sent invalid JSON`, 502)
			: errAsync(upstream(`${label} failed (${response.status})`))
	);
}

/** `ok` when the condition holds, otherwise the error. */
export function ensure(condition: unknown, error: AppError): Result<void, AppError> {
	return condition ? ok(undefined) : err(error);
}

/** Splits a list into slices of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
	const slices: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		slices.push(items.slice(i, i + size));
	}

	return slices;
}
