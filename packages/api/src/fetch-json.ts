import { errAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { apiError, type ApiError } from './errors';

const DEFAULT_TIMEOUT_MS = 8_000;

function messageFromBody(json: unknown, fallback: string): string {
	if (typeof json !== 'object' || json === null) {
		return fallback;
	}

	const message = (json as { message?: unknown }).message;
	return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

export function fetchJson<T>(
	fetchFn: typeof fetch,
	url: string,
	options: {
		fallback: string;
		schema: z.ZodType<T>;
		onStatus?: (status: number) => ApiError | undefined;
		init?: RequestInit;
		timeoutMs?: number;
	}
): ResultAsync<T, ApiError> {
	const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const signal = options.init?.signal ? AbortSignal.any([options.init.signal, timeout]) : timeout;
	return ResultAsync.fromPromise(fetchFn(url, { ...options.init, signal }), () =>
		apiError(500, options.fallback)
	).andThen((response) => {
		if (!response.ok) {
			return ResultAsync.fromSafePromise(
				response.json().then(
					(json) => json as unknown,
					() => null as unknown
				)
			).andThen((json) => {
				const mapped = options.onStatus?.(response.status);
				if (mapped) {
					return errAsync(apiError(mapped.status, messageFromBody(json, mapped.message)));
				}

				return errAsync(
					apiError(response.status || 500, messageFromBody(json, options.fallback))
				);
			});
		}

		return ResultAsync.fromPromise(response.json() as Promise<unknown>, () =>
			apiError(500, options.fallback)
		).andThen((json) => {
			const parsed = options.schema.safeParse(json);
			if (!parsed.success) {
				return errAsync(apiError(500, options.fallback));
			}

			return ResultAsync.fromSafePromise(Promise.resolve(parsed.data));
		});
	});
}
