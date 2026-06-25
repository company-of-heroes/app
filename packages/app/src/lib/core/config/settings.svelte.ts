import { watch } from 'runed';
import { exists } from '@tauri-apps/plugin-fs';
import {
	defaultSettings,
	validateSettings,
	type FeatureSlice,
	type Settings
} from './schema';
import { isV1Store, migrateToCurrent, migrateV1 } from './migrations';
import { readJsonWithRecovery, writeJsonAtomic } from './fs-json';
import { BackupService } from './backup';
import { Paths } from './paths';

/**
 * Single source of truth for all persisted application settings.
 *
 * - One reactive tree (`$state`), persisted atomically and debounced.
 * - Loading migrates the legacy plugin-store file (v1) transparently.
 * - Every persist schedules an external backup (see BackupService).
 * - `replace()` swaps the whole tree (used by import/restore) without
 *   requiring an app restart.
 */

export type SettingsSource = 'current' | 'legacy' | 'fresh';

export type SettingsLoadResult = {
	source: SettingsSource;
	recoveredFromTmp: boolean;
};

const PERSIST_DEBOUNCE_MS = 500;

export class SettingsService {
	tree = $state<Settings>(defaultSettings());
	status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	loadResult: SettingsLoadResult | null = null;

	readonly paths: Paths;
	readonly backup: BackupService;

	#persistTimer: ReturnType<typeof setTimeout> | null = null;
	#persistQueue: Promise<void> = Promise.resolve();
	#stopWatcher: (() => void) | null = null;
	#replacedListeners = new Set<(tree: Settings) => void>();

	constructor() {
		this.paths = new Paths(() => ({
			warningsLog: this.tree.app.companyOfHeroesConfigPath,
			gameDir: this.tree.app.companyOfHeroesInstallationPath
		}));
		this.backup = new BackupService(this.paths, () => $state.snapshot(this.tree) as Settings);
	}

	get app() {
		return this.tree.app;
	}

	get account() {
		return this.tree.account;
	}

	/**
	 * Loads settings from disk. Resolution order:
	 * 1. v2 settings file (with atomic-write crash recovery)
	 * 2. legacy v1 plugin-store file (migrated and persisted as v2)
	 * 3. fresh defaults (backup restore is offered separately by onboarding)
	 */
	async load(): Promise<SettingsLoadResult> {
		this.status = 'loading';

		try {
			const result = await this.#resolveFromDisk();

			this.tree = result.tree;
			this.loadResult = { source: result.source, recoveredFromTmp: result.recoveredFromTmp };

			if (result.shouldPersist) {
				await this.persistNow();
			}

			this.#startPersistWatcher();
			this.status = 'ready';

			return this.loadResult;
		} catch (error) {
			this.status = 'error';
			throw error;
		}
	}

	async #resolveFromDisk(): Promise<{
		tree: Settings;
		source: SettingsSource;
		recoveredFromTmp: boolean;
		shouldPersist: boolean;
	}> {
		const settingsPath = await this.paths.settingsFilePath();
		const current = await readJsonWithRecovery(settingsPath);

		if (current.ok) {
			const migrated = migrateToCurrent(current.data);

			if (migrated.success) {
				return {
					tree: migrated.data,
					source: 'current',
					recoveredFromTmp: current.recoveredFromTmp,
					shouldPersist: current.recoveredFromTmp
				};
			}

			console.error('[SETTINGS]: settings file is invalid, falling back:', migrated.error);
		}

		// Legacy plugin-store migration
		const legacyPath = await this.paths.legacyStoreFilePath();

		if (await exists(legacyPath)) {
			const legacy = await readJsonWithRecovery(legacyPath);

			if (legacy.ok && isV1Store(legacy.data)) {
				try {
					const tree = migrateV1(legacy.data);
					console.info('[SETTINGS]: migrated legacy app store to settings v2');
					return { tree, source: 'legacy', recoveredFromTmp: false, shouldPersist: true };
				} catch (error) {
					console.error('[SETTINGS]: legacy store migration failed:', error);
				}
			}
		}

		return { tree: defaultSettings(), source: 'fresh', recoveredFromTmp: false, shouldPersist: false };
	}

	#startPersistWatcher() {
		this.#stopWatcher?.();

		this.#stopWatcher = $effect.root(() => {
			watch(
				() => $state.snapshot(this.tree),
				(_value, previous) => {
					// Skip the initial run; only persist actual changes.
					if (previous === undefined) {
						return;
					}

					this.#schedulePersist();
				}
			);
		});
	}

	#schedulePersist() {
		if (this.#persistTimer) {
			clearTimeout(this.#persistTimer);
		}

		this.#persistTimer = setTimeout(() => {
			this.#persistTimer = null;
			void this.persistNow();
		}, PERSIST_DEBOUNCE_MS);
	}

	/** Persists the tree atomically. Serialized so writes never interleave. */
	persistNow(): Promise<void> {
		this.#persistQueue = this.#persistQueue
			.then(async () => {
				this.tree.updatedAt = new Date().toISOString();
				const snapshot = $state.snapshot(this.tree) as Settings;
				await writeJsonAtomic(await this.paths.settingsFilePath(), snapshot);
				this.backup.schedule();
			})
			.catch((error) => {
				console.error('[SETTINGS]: Failed to persist settings:', error);
			});

		return this.#persistQueue;
	}

	/** Flushes pending writes (call before the app closes). */
	async flush(): Promise<void> {
		if (this.#persistTimer) {
			clearTimeout(this.#persistTimer);
			this.#persistTimer = null;
			await this.persistNow();
		} else {
			await this.#persistQueue;
		}

		await this.backup.flush();
	}

	/**
	 * Validates and applies a full settings tree (import / backup restore).
	 * On failure nothing is touched.
	 */
	async replace(value: unknown): Promise<{ success: true } | { success: false; error: string }> {
		const migrated = migrateToCurrent(value);

		if (!migrated.success) {
			return { success: false, error: migrated.error };
		}

		await this.backup.backupNow('pre-import');

		this.tree = migrated.data;
		await this.persistNow();

		for (const listener of this.#replacedListeners) {
			try {
				listener(migrated.data);
			} catch (error) {
				console.error('[SETTINGS]: replaced listener failed:', error);
			}
		}

		return { success: true };
	}

	/** Registers a callback fired after `replace()` swapped the tree. */
	onReplaced(listener: (tree: Settings) => void): () => void {
		this.#replacedListeners.add(listener);
		return () => this.#replacedListeners.delete(listener);
	}

	getFeatureSlice(id: string): FeatureSlice | undefined {
		return this.tree.features[id];
	}

	updateFeatureSlice(id: string, slice: FeatureSlice): void {
		this.tree.features[id] = slice;
	}

	/** Validated snapshot of the current tree (for export/backup). */
	snapshot(): Settings {
		const snapshot = $state.snapshot(this.tree) as Settings;
		const validated = validateSettings(snapshot);
		return validated.success ? validated.data : snapshot;
	}
}

export const settings = new SettingsService();
