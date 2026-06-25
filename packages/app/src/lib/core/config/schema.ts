import { z } from 'zod';

/**
 * Versioned settings schema.
 *
 * All persisted application state lives in a single validated tree:
 *
 * ```jsonc
 * {
 *   "schemaVersion": 2,
 *   "updatedAt": "...",
 *   "app": { ... },          // global app settings
 *   "account": { ... },      // PocketBase credentials (also stored in external backups)
 *   "features": { "<id>": { "enabled": true, ... } }
 * }
 * ```
 *
 * Unknown keys are preserved (`loose`) so older app versions never destroy
 * data written by newer versions.
 */
export const SCHEMA_VERSION = 2;

export const appSettingsSchema = z
	.object({
		autostart: z.boolean().default(true),
		isStreamer: z.boolean().default(false),
		companyOfHeroesConfigPath: z.string().default(''),
		companyOfHeroesInstallationPath: z.string().default('')
	})
	.loose();

export const accountSettingsSchema = z
	.object({
		userId: z.string().default(''),
		email: z.string().default(''),
		password: z.string().default('')
	})
	.loose();

/**
 * Every feature slice must at least carry an `enabled` flag. Feature specific
 * keys are validated by the feature itself (via its `defaultSettings()` merge);
 * the tree keeps them as-is.
 */
export const featureSliceSchema = z
	.object({
		enabled: z.boolean().default(false)
	})
	.loose();

export const settingsSchema = z
	.object({
		schemaVersion: z.literal(SCHEMA_VERSION).catch(SCHEMA_VERSION),
		updatedAt: z.string().default(() => new Date().toISOString()),
		app: appSettingsSchema.default(() => appSettingsSchema.parse({})),
		account: accountSettingsSchema.default(() => accountSettingsSchema.parse({})),
		features: z.record(z.string(), featureSliceSchema).default({})
	})
	.loose();

export type AppSettings = z.infer<typeof appSettingsSchema> & { [key: string]: any };
export type AccountSettings = z.infer<typeof accountSettingsSchema>;
export type FeatureSlice = z.infer<typeof featureSliceSchema> & { [key: string]: unknown };
export type Settings = z.infer<typeof settingsSchema>;

/**
 * Creates a fresh settings tree with defaults.
 */
export function defaultSettings(): Settings {
	return settingsSchema.parse({});
}

/**
 * Validates an arbitrary value as a settings tree.
 * Returns the parsed tree or an error; never throws.
 */
export function validateSettings(
	value: unknown
): { success: true; data: Settings } | { success: false; error: string } {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return { success: false, error: 'Settings must be a JSON object' };
	}

	const result = settingsSchema.safeParse(value);

	if (!result.success) {
		return { success: false, error: z.prettifyError(result.error) };
	}

	return { success: true, data: result.data };
}
