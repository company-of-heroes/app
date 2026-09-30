import type { TypedPocketBase } from './types';
import type { Expand } from '@fknoobs/app';
import Pocketbase, { type FileOptions } from 'pocketbase';
import { camelCase } from 'lodash-es';
import { fetch as appFetch } from '$core/http/fetch';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { UserContext } from '$lib/components/user';

export const pocketbase = new Pocketbase(
	PUBLIC_PB_URL ?? 'https://api.coh1stats.com'
) as TypedPocketBase;
pocketbase.autoCancellation(false);

pocketbase.beforeSend = async (url, options) => ({
	url,
	options: { ...options, fetch: options.fetch ?? appFetch }
});

/**
 * Replaces reference arrays with their expanded objects from PocketBase expand property
 * and converts snake_case keys to camelCase
 *
 * @param obj - The PocketBase object with expand property
 * @returns A new object with expanded data replacing reference arrays and camelCase keys
 */
export function exp<T extends Record<string, any>>(obj: T): Expand<T> {
	if (obj === null || typeof obj !== 'object') {
		return obj as Expand<T>;
	}

	const { expand, ...result } = obj;
	const resultObj: Record<string, any> = { ...result };

	if (!expand || typeof expand !== 'object') {
		return resultObj as Expand<T>;
	}

	for (const [key, expandedValue] of Object.entries(expand)) {
		if (expandedValue !== null && expandedValue !== undefined) {
			const camelKey = camelCase(key);

			if (Array.isArray(expandedValue)) {
				resultObj[camelKey] = expandedValue.map((item) => exp(item));
			} else if (typeof expandedValue === 'object') {
				resultObj[camelKey] = exp(expandedValue);
			} else {
				resultObj[camelKey] = expandedValue;
			}
		}
	}

	for (const [key, value] of Object.entries(resultObj)) {
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			resultObj[key] = exp(value);
		} else if (Array.isArray(value)) {
			resultObj[key] = value.map((item) =>
				typeof item === 'object' && item !== null ? exp(item) : item
			);
		}
	}

	return resultObj as Expand<T>;
}

let fileTokenCache: { token: string; expiresAt: number } | null = null;
let fileTokenInflight: Promise<string> | null = null;
const FILE_TOKEN_REFRESH_MARGIN_MS = 30_000;
const FILE_DOWNLOAD_CONCURRENCY = 4;
let fileDownloadsActive = 0;
const fileDownloadWaiters: Array<() => void> = [];

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenExpiresAt(token: string): number {
	try {
		const part = token.split('.')[1];
		if (!part) {
			return Date.now() + 120_000;
		}

		const padded =
			part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
		const payload = JSON.parse(atob(padded)) as { exp?: number };
		if (typeof payload.exp === 'number') {
			return payload.exp * 1000;
		}
	} catch {
		// ignore malformed tokens
	}
	return Date.now() + 120_000;
}

async function withFileDownloadSlot<T>(run: () => Promise<T>): Promise<T> {
	if (fileDownloadsActive >= FILE_DOWNLOAD_CONCURRENCY) {
		await new Promise<void>((resolve) => fileDownloadWaiters.push(resolve));
	}

	fileDownloadsActive++;
	try {
		return await run();
	} finally {
		fileDownloadsActive--;
		fileDownloadWaiters.shift()?.();
	}
}

export async function getFileAccessToken() {
	const now = Date.now();
	if (fileTokenCache && now < fileTokenCache.expiresAt - FILE_TOKEN_REFRESH_MARGIN_MS) {
		return fileTokenCache.token;
	}

	if (fileTokenInflight) {
		return fileTokenInflight;
	}

	fileTokenInflight = pocketbase.files
		.getToken({ fetch: appFetch })
		.then((token) => {
			fileTokenCache = { token, expiresAt: tokenExpiresAt(token) };
			return token;
		})
		.finally(() => {
			fileTokenInflight = null;
		});
	return fileTokenInflight;
}

export const getFile = async (
	record: Record<string, unknown>,
	filename: string,
	queryParams?: FileOptions
) => {
	return withFileDownloadSlot(async () => {
		let token = queryParams?.token;
		let lastError: Error | null = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			if (!token) {
				try {
					token = await getFileAccessToken();
				} catch (error) {
					lastError = error instanceof Error ? error : new Error('Failed to get file token');
					if (attempt < 2) {
						await sleep(200 * (attempt + 1));
						continue;
					}
				}
			}

			const params: FileOptions = { ...queryParams };
			if (token) {
				params.token = token;
			}

			const response = await appFetch(pocketbase.files.getURL(record, filename, params));
			if (response.ok) {
				return new Uint8Array(await response.arrayBuffer());
			}

			lastError = new Error(`Failed to download file (${response.status})`);
			if (response.status === 401 || response.status === 403) {
				token = undefined;
				fileTokenCache = null;
				await sleep(150 * (attempt + 1));
				continue;
			}

			if (response.status >= 500 || response.status === 429) {
				await sleep(300 * (attempt + 1));
				continue;
			}

			throw lastError;
		}
		throw lastError ?? new Error('Failed to download file');
	});
};

export const getFileUrl = (
	record: Record<string, unknown> | UserContext,
	filename: string,
	queryParams?: FileOptions
) => {
	return pocketbase.files.getURL(record, filename, queryParams);
};
