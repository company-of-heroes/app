import { json, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { err, ok, ResultAsync, type Result } from 'neverthrow';
import type { z } from 'zod';
import { canHostTournaments, isStaffUser, type AuthUserPublic } from '$lib/auth/user';
import { badRequest, forbidden, unauthorized, type AppError } from './errors';
import type { Task } from './result';
import { parse } from './validate';

export { parse };

/** Error responses keep the `{ message }` shape (plus `retry-after` on 429). */
export function errorResponse(appError: AppError): Response {
	const headers: Record<string, string> = {};
	if (appError.retryAfter !== undefined) {
		headers['retry-after'] = String(appError.retryAfter);
	}

	return json({ message: appError.message }, { status: appError.status, headers });
}

/**
 * Wraps a route handler that returns a Result: `err` becomes a JSON error, `ok` a
 * JSON body (or the `Response` itself). Anything thrown is logged and becomes a 500.
 */
export function handle(
	fn: (
		event: RequestEvent
	) =>
		| ResultAsync<unknown, AppError>
		| Result<unknown, AppError>
		| Promise<Result<unknown, AppError>>
) {
	return async (event: RequestEvent): Promise<Response> => {
		try {
			const result = await fn(event);
			if (result.isErr()) {
				return errorResponse(result.error);
			}

			return result.value instanceof Response ? result.value : json(result.value);
		} catch (cause) {
			console.error(`[api] ${event.request.method} ${event.url.pathname}`, cause);
			return json({ message: 'Something went wrong. Please try again later.' }, { status: 500 });
		}
	};
}

export function parseQuery<T extends z.ZodType>(schema: T, url: URL): Result<z.infer<T>, AppError> {
	return parse(schema, Object.fromEntries(url.searchParams));
}

export function parseBody<T extends z.ZodType>(schema: T, request: Request): Task<z.infer<T>> {
	return ResultAsync.fromPromise(request.json(), () => badRequest('Invalid JSON body')).andThen(
		(body) => parse(schema, body)
	);
}

export function requireUser(event: RequestEvent): Result<AuthUserPublic, AppError> {
	const user = event.locals.user;
	if (!user) {
		return err(unauthorized('Sign in required'));
	}

	return ok(user);
}

/** Admins and moderators. */
export function requireStaff(event: RequestEvent): Result<AuthUserPublic, AppError> {
	return requireUser(event).andThen((user) =>
		isStaffUser(user) ? ok(user) : err(forbidden('Only staff can do that.'))
	);
}

/** Staff and community hosts: may create tournaments (a host runs only their own). */
export function requireHost(event: RequestEvent): Result<AuthUserPublic, AppError> {
	return requireUser(event).andThen((user) =>
		canHostTournaments(user)
			? ok(user)
			: err(forbidden('Only staff and tournament hosts can do that.'))
	);
}

/** Service-to-service calls (jobs worker, gateway internals) use `Authorization: Bearer <SERVICE_TOKEN>`. */
export function requireService(
	event: RequestEvent,
	token = env.SERVICE_TOKEN
): Result<void, AppError> {
	const header = event.request.headers.get('authorization') ?? '';
	if (!token || !timingSafeEqual(header, `Bearer ${token}`)) {
		return err(unauthorized());
	}

	return ok(undefined);
}

/**
 * The smurf worker's routes: its own `SMURF_SERVICE_TOKEN` (so that worker never holds the
 * main service token), or the main one.
 */
export function requireSmurfService(event: RequestEvent): Result<void, AppError> {
	return env.SMURF_SERVICE_TOKEN
		? requireService(event, env.SMURF_SERVICE_TOKEN).orElse(() => requireService(event))
		: requireService(event);
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function jsonField(value: string): Result<unknown, AppError> {
	try {
		return ok(JSON.parse(value));
	} catch {
		return err(badRequest('Invalid JSON field'));
	}
}

type RecordBody = { data: Record<string, unknown>; files: Record<string, File> };

function formBody(form: FormData): Result<RecordBody, AppError> {
	const data: Record<string, unknown> = {};
	const files: Record<string, File> = {};
	for (const [key, value] of form) {
		if (typeof value !== 'string') {
			files[key] = value;
		} else if (key === '@jsonPayload') {
			const payload = jsonField(value);
			if (payload.isErr()) {
				return err(payload.error);
			}

			Object.assign(data, payload.value);
		} else if (/^\s*[[{]/.test(value)) {
			const field = jsonField(value);
			if (field.isErr()) {
				return err(field.error);
			}

			data[key] = field.value;
		} else {
			data[key] = value;
		}
	}
	return ok({ data, files });
}

/**
 * A record write body: JSON, or multipart with files. The PocketBase SDK puts the
 * non-file fields of a multipart body in `@jsonPayload`; plain form fields that
 * hold JSON (arrays, objects) are parsed too.
 */
export function readRecordBody(request: Request): Task<RecordBody> {
	const type = request.headers.get('content-type') ?? '';
	if (
		!type.includes('multipart/form-data') &&
		!type.includes('application/x-www-form-urlencoded')
	) {
		return ResultAsync.fromPromise(request.json(), () => badRequest('Invalid JSON body')).map(
			(data) => ({ data: data && typeof data === 'object' ? data : {}, files: {} })
		);
	}

	return ResultAsync.fromPromise(request.formData(), () => badRequest('Invalid form body')).andThen(
		formBody
	);
}
