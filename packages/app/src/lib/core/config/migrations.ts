import { SCHEMA_VERSION, validateSettings, type Settings } from './schema';

/**
 * Settings migrations.
 *
 * v1: the legacy `@tauri-apps/plugin-store` file (`app.json` / `app.dev.json`)
 *     with flat keys: `settings`, `feature.auth`, `feature.twitch`, ...
 * v2: the unified, versioned settings tree (see schema.ts).
 */

/** Legacy store keys that are intentionally not carried over. */
const V1_DROPPED_FEATURES = new Set(['chat']);

/** Legacy feature key renames (old store name -> canonical feature id). */
const V1_FEATURE_RENAMES: Record<string, string> = {
	History: 'history',
	overlays: 'twitch-overlays'
};

export function isV1Store(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	if ('schemaVersion' in obj) {
		return false;
	}

	return 'settings' in obj || Object.keys(obj).some((key) => key.startsWith('feature.'));
}

export function isV2Tree(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		(value as Record<string, unknown>).schemaVersion === SCHEMA_VERSION
	);
}

/**
 * Migrates a legacy plugin-store object (v1) to a v2 settings tree.
 */
export function migrateV1(store: Record<string, unknown>): Settings {
	const appSlice =
		store.settings && typeof store.settings === 'object'
			? (store.settings as Record<string, unknown>)
			: {};

	const authSlice =
		store['feature.auth'] && typeof store['feature.auth'] === 'object'
			? (store['feature.auth'] as Record<string, unknown>)
			: {};

	const features: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(store)) {
		if (!key.startsWith('feature.')) continue;

		const legacyName = key.slice('feature.'.length);

		if (legacyName === 'auth' || V1_DROPPED_FEATURES.has(legacyName)) {
			continue;
		}

		const id = V1_FEATURE_RENAMES[legacyName] ?? legacyName;

		if (value && typeof value === 'object') {
			features[id] = value;
		}
	}

	const candidate = {
		schemaVersion: SCHEMA_VERSION,
		updatedAt: new Date().toISOString(),
		app: appSlice,
		account: {
			userId: typeof authSlice.userId === 'string' ? authSlice.userId : '',
			email: typeof authSlice.email === 'string' ? authSlice.email : '',
			password: typeof authSlice.password === 'string' ? authSlice.password : ''
		},
		features
	};

	const result = validateSettings(candidate);

	if (!result.success) {
		// v1 content was malformed beyond repair; fall back to a tree that at
		// least preserves the raw slices for manual recovery.
		throw new Error(`Failed to migrate v1 settings: ${result.error}`);
	}

	return result.data;
}

/**
 * Normalizes any known persisted format (v1 store, v2 tree, v2 envelope payload)
 * into a validated v2 settings tree. Returns an error for unknown shapes.
 */
export function migrateToCurrent(
	value: unknown
): { success: true; data: Settings } | { success: false; error: string } {
	try {
		if (isV1Store(value)) {
			return { success: true, data: migrateV1(value) };
		}

		return validateSettings(value);
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
