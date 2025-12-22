import type { TypedPocketBase } from './types';
import type { Expand } from '@fknoobs/app';
import Pocketbase, { type FileOptions } from 'pocketbase';
import { camelCase } from 'lodash-es';
import { fetch } from '@tauri-apps/plugin-http';
import { PUBLIC_PB_URL } from '$env/static/public';

export const pocketbase = new Pocketbase(
	PUBLIC_PB_URL ?? 'https://api.fknoobs.com'
) as TypedPocketBase;
pocketbase.autoCancellation(false);

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

export const getFile = async (
	record: Record<string, unknown>,
	filename: string,
	queryParams?: FileOptions
) => {
	return fetch(pocketbase.files.getURL(record, filename, queryParams))
		.then((res) => res.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));
};
