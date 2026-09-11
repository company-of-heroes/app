import { error, fail } from '@sveltejs/kit';
import type { Result, ResultAsync } from 'neverthrow';
import type { AppError } from './app-error';

export function unwrap<T>(result: Result<T, AppError>): T {
	if (result.isOk()) {
		return result.value;
	}

	error(result.error.status, result.error.message);
}

export async function unwrapAsync<T>(result: ResultAsync<T, AppError>): Promise<T> {
	return unwrap(await result);
}

export function failFrom(appError: AppError, extra?: Record<string, unknown>) {
	return fail(appError.status, { message: appError.message, ...extra });
}
