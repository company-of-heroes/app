import { ClientResponseError, type RecordModel } from 'pocketbase';
import { errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { ApiDeps } from '../deps';
import { normalizeBaseUrl } from '../deps';
import { apiError, fromUnknown, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { generateUniqueId } from '../id';
import { escapePocketBaseString, fromPbPromise, pbOptions, requireAuth } from '../pb';
import { isStaff } from '../staff';
import { readMetaVersion } from '../companion/meta';

export type UserRole = 'admin' | 'moderator';

export type AuthUser = RecordModel & {
	email: string;
	name?: string;
	avatar?: string;
	steamIds?: string[];
	role?: UserRole;
	verified?: boolean;
};

export type CompanionUserDebug = {
	id: string;
	email: string;
	role?: string;
	lastLogin?: string;
	created?: string;
	updated?: string;
	appVersion: string | null;
};

export type AuthExchange = {
	token: string;
	record: AuthUser;
};

export const PLACEHOLDER_EMAIL_DOMAIN = '@fknoobs.com';

export function isPlaceholderEmail(email: string): boolean {
	return email.trim().toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/** True when the user may start an email-change (verified or still on a placeholder). */
export function canRequestEmailChange(user: { email: string; verified?: boolean }): boolean {
	return Boolean(user.verified) || isPlaceholderEmail(user.email);
}

const authExchangeSchema = z.object({
	token: z.string().min(1),
	record: z.object({ id: z.string().min(1) }).passthrough()
});

export class AuthApi {
	constructor(private deps: ApiDeps) {}

	login(email: string, password: string): ResultAsync<AuthUser, ApiError> {
		return ResultAsync.fromPromise(
			this.deps.pocketbase.collection('users').authWithPassword(email.trim(), password),
			toLoginError
		).map((auth) => auth.record as AuthUser);
	}

	register(email: string, password: string): ResultAsync<AuthUser, ApiError> {
		const trimmedEmail = email.trim();
		return ResultAsync.fromPromise(
			this.deps.pocketbase.collection('users').create(
				{
					id: generateUniqueId(),
					email: trimmedEmail,
					password,
					passwordConfirm: password
				},
				pbOptions(this.deps)
			),
			toRegisterError
		)
			.andThen(() =>
				ResultAsync.fromPromise(
					this.deps.pocketbase.collection('users').authWithPassword(trimmedEmail, password),
					toRegisterError
				)
			)
			.map((auth) => auth.record as AuthUser);
	}

	logout(): Result<void, ApiError> {
		this.deps.pocketbase.authStore.clear();
		return ok(undefined);
	}

	steamLoginStartUrl(origin: string, redirect = '/'): string {
		const params = new URLSearchParams();
		params.set('origin', origin.replace(/\/$/, ''));
		if (redirect && redirect !== '/') {
			params.set('redirect', redirect);
		}

		return `${normalizeBaseUrl(this.deps.baseUrl)}/api/auth/steam/start?${params.toString()}`;
	}

	exchangeHandoffCode(code: string): ResultAsync<AuthExchange, ApiError> {
		const trimmed = code.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Invalid or expired login link.'));
		}

		const url = `${normalizeBaseUrl(this.deps.baseUrl)}/api/auth/handoff/exchange`;
		return ResultAsync.fromPromise(
			this.deps.fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: trimmed }),
				signal: AbortSignal.timeout(15_000)
			}),
			() => apiError(500, 'Invalid or expired login link.')
		).andThen((response) =>
			ResultAsync.fromPromise(response.json() as Promise<unknown>, () =>
				apiError(response.ok ? 500 : 400, 'Invalid or expired login link.')
			).andThen((json) => {
				if (!response.ok) {
					const bodyMessage =
						json &&
						typeof json === 'object' &&
						typeof (json as { message?: unknown }).message === 'string'
							? (json as { message: string }).message.trim()
							: '';
					const message = bodyMessage || 'Invalid or expired login link.';
					const status =
						response.status >= 400 && response.status < 600 ? response.status : 400;
					return errAsync(apiError(status, message));
				}

				const parsed = authExchangeSchema.safeParse(json);
				if (!parsed.success) {
					return errAsync(apiError(500, 'Invalid or expired login link.'));
				}

				return okAsync({
					token: parsed.data.token,
					record: parsed.data.record as AuthUser
				});
			})
		);
	}

	updateProfile(input: {
		name?: string;
		avatar?: File | null;
	}): ResultAsync<AuthUser, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const payload: Record<string, unknown> = {};
		if (input.name !== undefined) {
			payload.name = input.name.trim();
		}

		if (input.avatar !== undefined) {
			payload.avatar = input.avatar;
		}

		if (Object.keys(payload).length === 0) {
			const record = this.deps.pocketbase.authStore.record as AuthUser | null;
			if (!record) {
				return errAsync(apiError(401, 'Log in to do that.'));
			}

			return okAsync(record);
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('users')
				.update(auth.value, payload, pbOptions(this.deps))
				.then((record) => this.#saveAuthRecord(record as AuthUser)),
			'Could not update your profile.'
		);
	}

	updatePassword(input: {
		oldPassword: string;
		password: string;
	}): ResultAsync<AuthUser, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const password = input.password;
		if (password.length < 8) {
			return errAsync(apiError(400, 'Password must be at least 8 characters.'));
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('users')
				.update(
					auth.value,
					{
						oldPassword: input.oldPassword,
						password,
						passwordConfirm: password
					},
					pbOptions(this.deps)
				)
				.then((record) => this.#saveAuthRecord(record as AuthUser)),
			'Could not update your password.'
		);
	}

	#saveAuthRecord(record: AuthUser): AuthUser {
		const token = this.deps.pocketbase.authStore.token;
		if (token) {
			this.deps.pocketbase.authStore.save(token, record);
		}

		return record;
	}

	requestVerification(email: string): ResultAsync<boolean, ApiError> {
		const trimmed = email.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Email is required.'));
		}

		if (isPlaceholderEmail(trimmed)) {
			return errAsync(apiError(400, 'Set a real email address before verifying.'));
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('users')
				.requestVerification(trimmed, pbOptions(this.deps))
				.then(() => true),
			'Could not send the verification email.'
		);
	}

	confirmVerification(token: string): ResultAsync<boolean, ApiError> {
		const trimmed = token.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Invalid or expired verification link.'));
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('users')
				.confirmVerification(trimmed, pbOptions(this.deps))
				.then(() => true),
			'Invalid or expired verification link.'
		);
	}

	requestEmailChange(newEmail: string): ResultAsync<boolean, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const record = this.deps.pocketbase.authStore.record as AuthUser | null;
		if (!record) {
			return errAsync(apiError(401, 'Log in to do that.'));
		}

		if (!canRequestEmailChange(record)) {
			return errAsync(apiError(400, 'Verify your email before changing it.'));
		}

		const trimmed = newEmail.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Email is required.'));
		}

		if (trimmed.toLowerCase() === record.email.trim().toLowerCase()) {
			return errAsync(apiError(400, 'That is already your email address.'));
		}

		if (isPlaceholderEmail(trimmed)) {
			return errAsync(apiError(400, 'Choose a real email address.'));
		}

		return ResultAsync.fromPromise(
			this.deps.pocketbase
				.collection('users')
				.requestEmailChange(trimmed, pbOptions(this.deps))
				.then(() => true),
			(error) => toAuthMutationError(error, 'Could not send the email change confirmation.')
		);
	}

	confirmEmailChange(token: string, password: string): ResultAsync<AuthUser, ApiError> {
		const trimmed = token.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Invalid or expired email change link.'));
		}

		if (!password) {
			return errAsync(apiError(400, 'Password is required.'));
		}

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/collections/users/confirm-email-change`,
			{
				fallback: 'Invalid or expired email change link.',
				schema: authExchangeSchema,
				onStatus: (status) => {
					if (status === 400 || status === 401 || status === 404) {
						return apiError(400, 'Invalid or expired email change link.');
					}

					return undefined;
				},
				init: {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: trimmed, password })
				}
			}
		).map((body) => {
			const record = body.record as AuthUser;
			this.deps.pocketbase.authStore.save(body.token, record);
			return record;
		});
	}

	findCompanionBySteamId(steamId: string): ResultAsync<CompanionUserDebug | null, ApiError> {
		if (!isStaff(this.deps)) {
			return okAsync(null);
		}

		const id = steamId.trim();
		if (!id) {
			return okAsync(null);
		}

		const escaped = escapePocketBaseString(id);
		return ResultAsync.fromPromise(
			this.deps.pocketbase.collection('users').getList(
				1,
				1,
				pbOptions(this.deps, {
					filter: `steamIds ~ "${escaped}"`
				})
			),
			(error) => fromUnknown(error, 'Could not load that account.')
		)
			.map((list) => {
				const row = list.items[0];
				if (!row) {
					return null;
				}

				return {
					id: row.id,
					email: typeof row.email === 'string' ? row.email : '',
					role: typeof row.role === 'string' ? row.role : undefined,
					lastLogin: typeof row.lastLogin === 'string' ? row.lastLogin : undefined,
					created: typeof row.created === 'string' ? row.created : undefined,
					updated: typeof row.updated === 'string' ? row.updated : undefined,
					appVersion: readMetaVersion(row.meta)
				};
			});
	}
}

function toLoginError(error: unknown): ApiError {
	if (error instanceof ClientResponseError) {
		if (error.status === 400 || error.status === 404 || error.status === 401) {
			return apiError(400, 'Invalid email or password.');
		}

		if (error.status === 429) {
			return apiError(429, 'Too many attempts. Please wait a moment and try again.');
		}

		const data = error.data as { message?: string } | undefined;
		if (data?.message) {
			return apiError(400, data.message);
		}
	}

	return fromUnknown(error, 'Something went wrong. Please try again.');
}

function toRegisterError(error: unknown): ApiError {
	if (error instanceof ClientResponseError) {
		if (error.status === 429) {
			return apiError(429, 'Too many attempts. Please wait a moment and try again.');
		}

		const data = error.data as { message?: string } | undefined;
		if (data?.message) {
			return apiError(400, data.message);
		}

		if (error.status === 400) {
			return apiError(400, 'Could not create that account. Check your email and password.');
		}
	}

	return fromUnknown(error, 'Something went wrong. Please try again.');
}

function toAuthMutationError(error: unknown, fallback: string): ApiError {
	if (error instanceof ClientResponseError) {
		if (error.status === 401 || error.status === 403) {
			return apiError(401, 'Log in to do that.');
		}

		if (error.status === 429) {
			return apiError(429, 'Too many attempts. Please wait a moment and try again.');
		}

		const data = error.data as
			| { message?: string; data?: Record<string, { message?: string }> }
			| undefined;
		const fieldMessage = data?.data
			? Object.values(data.data)
					.map((field) => field?.message)
					.filter(Boolean)
					.join(' ')
			: '';
		if (fieldMessage || data?.message) {
			return apiError(400, fieldMessage || data?.message || fallback);
		}

		if (error.status > 0) {
			return apiError(error.status, fallback);
		}
	}

	return fromUnknown(error, fallback);
}
