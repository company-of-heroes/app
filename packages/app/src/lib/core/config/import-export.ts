import { migrateToCurrent } from './migrations';
import { SCHEMA_VERSION, type FeatureSlice, type Settings } from './schema';

/**
 * Validated settings import/export.
 *
 * Exports are wrapped in a versioned envelope. Imports accept:
 * - a full envelope (current format)
 * - a raw v2 settings tree
 * - a legacy v1 plugin-store file (auto-migrated)
 * - for feature imports: a feature envelope or a raw settings slice (legacy)
 *
 * Parsing is pure and never applies anything; applying is done by the caller
 * via `SettingsService.replace()` so a failed import touches nothing.
 */

export const ENVELOPE_KIND = 'fknoobs-settings';

export type SettingsEnvelope = {
	kind: typeof ENVELOPE_KIND;
	scope: 'full' | `feature:${string}`;
	schemaVersion: number;
	appVersion: string;
	exportedAt: string;
	payload: unknown;
};

export function createEnvelope(settings: Settings, appVersion: string): SettingsEnvelope {
	return {
		kind: ENVELOPE_KIND,
		scope: 'full',
		schemaVersion: SCHEMA_VERSION,
		appVersion,
		exportedAt: new Date().toISOString(),
		payload: settings
	};
}

export function createFeatureEnvelope(
	featureId: string,
	slice: FeatureSlice,
	appVersion: string
): SettingsEnvelope {
	return {
		kind: ENVELOPE_KIND,
		scope: `feature:${featureId}`,
		schemaVersion: SCHEMA_VERSION,
		appVersion,
		exportedAt: new Date().toISOString(),
		payload: slice
	};
}

function isEnvelope(value: unknown): value is SettingsEnvelope {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		(value as Record<string, unknown>).kind === ENVELOPE_KIND
	);
}

export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Parses the content of a full-settings import file into a validated tree.
 */
export function parseImportContent(content: string): ParseResult<Settings> {
	let value: unknown;

	try {
		value = JSON.parse(content);
	} catch {
		return { success: false, error: 'File is not valid JSON' };
	}

	if (isEnvelope(value)) {
		if (value.scope !== 'full') {
			return {
				success: false,
				error: `This file is a "${value.scope}" export, not a full settings export`
			};
		}

		return migrateToCurrent(value.payload);
	}

	return migrateToCurrent(value);
}

/**
 * Parses the content of a per-feature import file into a raw settings slice.
 * The feature itself validates/merges the slice against its defaults.
 */
export function parseFeatureImportContent(
	content: string,
	featureId: string
): ParseResult<FeatureSlice> {
	let value: unknown;

	try {
		value = JSON.parse(content);
	} catch {
		return { success: false, error: 'File is not valid JSON' };
	}

	if (isEnvelope(value)) {
		if (value.scope !== `feature:${featureId}`) {
			return {
				success: false,
				error: `This file is a "${value.scope}" export and cannot be imported into "${featureId}"`
			};
		}

		value = value.payload;
	}

	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return { success: false, error: 'Settings must be a JSON object' };
	}

	return { success: true, data: value as FeatureSlice };
}

export function serializeEnvelope(envelope: SettingsEnvelope): string {
	return JSON.stringify(envelope, null, '\t');
}
