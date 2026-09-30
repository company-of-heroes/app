import { ClientResponseError } from 'pocketbase';
import type PocketBase from 'pocketbase';

export type ApiDeps = {
	pocketbase: PocketBase;
	fetch: typeof globalThis.fetch;
	/** PocketBase: records, files, auth and realtime. */
	baseUrl: string;
	/** The website; its /api/v1 serves everything that is not a plain PocketBase record (default coh1stats.com). */
	siteUrl?: string;
	/** Optional override when authStore alone is not enough (e.g. desktop account fallback). */
	userId?: () => string | undefined | null;
	/** Optional extra HTTP headers for authenticated API routes (hosts may add proxy secrets). */
	getAuthHeaders?: () => Record<string, string> | undefined | null;
};

export const DEFAULT_SITE_URL = 'https://coh1stats.com';

export function normalizeBaseUrl(baseUrl: string) {
	return baseUrl.replace(/\/$/, '');
}

export function resolveAuthHeaders(
	deps: ApiDeps,
	extra?: Record<string, string>
): Record<string, string> {
	const headers: Record<string, string> = {};
	const token = deps.pocketbase.authStore.token;
	if (token) {
		headers.Authorization = token;
	}

	const fromDeps = deps.getAuthHeaders?.();
	if (fromDeps) {
		Object.assign(headers, fromDeps);
	}

	if (extra) {
		Object.assign(headers, extra);
	}

	return headers;
}

/** The website's origin. */
export function siteUrl(deps: ApiDeps): string {
	return normalizeBaseUrl(deps.siteUrl ?? DEFAULT_SITE_URL);
}

/** The website's API root (`https://coh1stats.com/api/v1`). */
export function v1Base(deps: ApiDeps): string {
	return `${siteUrl(deps)}/api/v1`;
}

/** Absolute URL of a website API route, e.g. `v1Url(deps, '/players/search')`. */
export function v1Url(deps: ApiDeps, path: string): string {
	return `${v1Base(deps)}${path}`;
}

/** Non-file fields go in `@jsonPayload`, the way the PocketBase SDK sends multipart bodies. */
function toFormData(body: Record<string, unknown>): FormData {
	const form = new FormData();
	const json: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(body)) {
		if (value instanceof Blob) {
			form.append(key, value);
		} else {
			json[key] = value;
		}
	}
	form.append('@jsonPayload', JSON.stringify(json));
	return form;
}

/**
 * Calls a website API route the way `pocketbase.send` calls PocketBase: JSON (or
 * multipart when the body holds files), the user's token, and a
 * `ClientResponseError` for error responses.
 */
export async function sendV1<T>(
	deps: ApiDeps,
	path: string,
	options: {
		method?: string;
		body?: Record<string, unknown> | FormData;
		headers?: Record<string, string>;
		signal?: AbortSignal;
	} = {}
): Promise<T> {
	const url = v1Url(deps, path);
	const headers = resolveAuthHeaders(deps, options.headers);
	let body: BodyInit | undefined;

	if (options.body instanceof FormData) {
		body = options.body;
	} else if (options.body) {
		const hasFile = Object.values(options.body).some((value) => value instanceof Blob);
		body = hasFile ? toFormData(options.body) : JSON.stringify(options.body);
		if (!hasFile) {
			headers['Content-Type'] = 'application/json';
		}
	}

	const response = await deps.fetch(url, {
		method: options.method ?? 'GET',
		headers,
		body,
		signal: options.signal
	});

	const data = response.status === 204 ? null : await response.json().catch(() => null);
	if (!response.ok) {
		throw new ClientResponseError({ url, status: response.status, response: data ?? {} });
	}

	return data as T;
}
