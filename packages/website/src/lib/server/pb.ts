import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { API_URL } from '$lib/site/urls';

type Fetch = typeof fetch;

function withFetch(pb: PocketBase, fetchFn: Fetch): PocketBase {
	pb.autoCancellation(false);
	pb.beforeSend = (url, options) => ({
		url,
		options: { ...options, fetch: options.fetch ?? fetchFn }
	});
	return pb;
}

/**
 * Client acting as the signed-in user: from the website's `pb_auth` cookie, or
 * the desktop app's raw `Authorization: <token>` header.
 */
export function createUserPocketBase(request: Request, fetchFn: Fetch): PocketBase {
	const pb = withFetch(new PocketBase(API_URL), fetchFn);
	const cookie = request.headers.get('cookie') ?? '';
	if (cookie.includes('pb_auth')) {
		pb.authStore.loadFromCookie(cookie);
		return pb;
	}

	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (token) {
		pb.authStore.save(token, null);
	}

	return pb;
}

/** Log in again this long before the superuser token expires. */
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

/** The superuser session, shared by all requests in this Worker isolate. */
let superuser: { token: string; expiresAt: number } | null = null;
let loggingIn: Promise<string> | null = null;

function tokenExpiry(token: string): number {
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return Number(payload.exp) * 1000;
	} catch {
		return 0;
	}
}

async function logIn(fetchFn: Fetch): Promise<string> {
	const response = await fetchFn(`${API_URL}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identity: env.PB_SUPERUSER_EMAIL, password: env.PB_SUPERUSER_PASSWORD })
	});
	if (!response.ok) {
		throw new Error(`PocketBase superuser login failed (${response.status})`);
	}

	const { token } = (await response.json()) as { token: string };
	superuser = { token, expiresAt: tokenExpiry(token) };
	return token;
}

/** A valid superuser token: the configured one, or a cached login (renewed before it expires). */
async function superuserToken(fetchFn: Fetch): Promise<string> {
	if (env.PB_SUPERUSER_TOKEN) {
		return env.PB_SUPERUSER_TOKEN;
	}

	if (superuser && superuser.expiresAt - TOKEN_MARGIN_MS > Date.now()) {
		return superuser.token;
	}

	loggingIn ??= logIn(fetchFn).finally(() => {
		loggingIn = null;
	});
	return loggingIn;
}

/**
 * Superuser client for writes that bypass API rules (counters, ledgers, jobs).
 * Logs in with `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` (a dedicated superuser
 * without MFA) and keeps the session per isolate; `PB_SUPERUSER_TOKEN` (an
 * impersonate token from the PocketBase dashboard) overrides the login.
 */
export function createAdminPocketBase(fetchFn: Fetch): PocketBase {
	if (!env.PB_SUPERUSER_TOKEN && !(env.PB_SUPERUSER_EMAIL && env.PB_SUPERUSER_PASSWORD)) {
		throw new Error('Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD (or PB_SUPERUSER_TOKEN)');
	}

	const pb = withFetch(new PocketBase(API_URL), fetchFn);
	pb.beforeSend = async (url, options) => {
		const headers = { ...(options.headers as Record<string, string> | undefined) };
		// Calls that bring their own credentials (e.g. the service token) keep them.
		if (!Object.keys(headers).some((name) => name.toLowerCase() === 'authorization')) {
			headers.Authorization = await superuserToken(fetchFn);
		}

		return { url, options: { ...options, headers, fetch: options.fetch ?? fetchFn } };
	};
	pb.afterSend = (response, data) => {
		// Session revoked (e.g. password changed, token secret rotated): log in again on the
		// next request. PocketBase treats an invalid token as a guest, so that shows up as a
		// 403 on superuser-only collections rather than a 401.
		if ((response.status === 401 || response.status === 403) && !env.PB_SUPERUSER_TOKEN) {
			superuser = null;
		}

		return data;
	};
	return pb;
}

/** PocketBase rejects a `filter` longer than about 3500 characters. */
export const MAX_FILTER_LENGTH = 3000;

/** Joins conditions with `||` into as few filters as fit PocketBase's length limit. */
export function anyOfChunks(conditions: string[], maxLength = MAX_FILTER_LENGTH): string[] {
	const chunks: string[] = [];
	let current: string[] = [];
	let length = 0;
	for (const condition of conditions) {
		if (current.length > 0 && length + condition.length + 4 > maxLength) {
			chunks.push(current.join(' || '));
			current = [];
			length = 0;
		}

		current.push(condition);
		length += condition.length + 4;
	}
	if (current.length > 0) {
		chunks.push(current.join(' || '));
	}

	return chunks;
}
