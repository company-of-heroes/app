import type { Component } from 'svelte';
import { watch } from 'runed';
import { cloneDeep, defaultsDeep, isPlainObject, mergeWith } from 'lodash-es';
import Emittery from 'emittery';
import { open, save } from '@tauri-apps/plugin-dialog';
import { documentDir, join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { settings as settingsService } from '$core/config/settings.svelte';
import {
	createFeatureEnvelope,
	parseFeatureImportContent,
	serializeEnvelope
} from '$core/config/import-export';

export type FeatureStatus = 'disabled' | 'starting' | 'active' | 'error';

export interface Feature<
	Settings extends Record<string, unknown> | { enabled: boolean } = { enabled: boolean }
> {
	defaultSettings(): Promise<Settings> | Settings;
	disable(): Promise<void> | this | void;
}

/**
 * Base class for application features.
 *
 * - Settings are a slice of the central settings tree (`features.<name>`),
 *   merged with the feature's defaults and written back on change.
 * - Lifecycle is deterministic: transitions are serialized, `disable()` always
 *   runs before a re-`enable()`, and failures are isolated (status: 'error')
 *   so one broken feature never breaks the app.
 * - A full settings import/restore re-syncs the slice and restarts the
 *   feature with the new configuration automatically.
 */
export abstract class Feature<
	Settings extends Record<string, unknown> | { enabled: boolean } = { enabled: boolean },
	Events = {},
	Props extends Record<string, any> = {}
> extends Emittery<Events> {
	/** Canonical feature id; used as the settings key. */
	abstract name: string;

	/** Reactive feature settings (slice of the central tree). */
	settings = $state({ enabled: false }) as Settings & { enabled: boolean };

	/** Whether the feature should be running. */
	enabled = $derived.by(() => this.settings.enabled);

	/** Current lifecycle status. */
	status = $state<FeatureStatus>('disabled');

	/** Components contributed by the feature (rendered by feature hosts). */
	components: { component: Component<Props>; props?: Props }[] = $state([]);

	#registered = false;
	#transitionQueue: Promise<void> = Promise.resolve();
	#disposeWatchers: (() => void) | null = null;

	addComponent(component: Component<Props>, props?: Props) {
		this.components.push({ component, props });
	}

	/**
	 * Initializes settings from the central tree and starts the feature when
	 * enabled. Resolves after the initial transition completed. Idempotent.
	 */
	async register(): Promise<this> {
		if (this.#registered) {
			return this;
		}

		this.#registered = true;

		await this.#loadSettings();

		this.#disposeWatchers = $effect.root(() => {
			// Persist slice changes into the central settings tree.
			watch(
				() => $state.snapshot(this.settings),
				(snapshot) => {
					settingsService.updateFeatureSlice(this.name, snapshot as never);
				}
			);

			// React to enable/disable toggles.
			watch(
				() => this.enabled,
				(enabled, previous) => {
					if (previous === undefined) {
						return;
					}

					void this.#transition(enabled);
				}
			);
		});

		// A full settings replace (import/restore) re-syncs and restarts.
		settingsService.onReplaced(() => {
			void this.#reload();
		});

		await this.#transition(this.enabled);

		return this;
	}

	async #loadSettings(): Promise<void> {
		const slice = settingsService.getFeatureSlice(this.name);
		const defaults = (await this.defaultSettings?.()) ?? ({} as Settings);

		const merged = defaultsDeep(
			cloneDeep(slice ?? {}),
			cloneDeep(defaults)
		) as Settings & { enabled: boolean };

		merged.enabled = Boolean(merged.enabled ?? false);

		this.settings = merged;
		settingsService.updateFeatureSlice(this.name, $state.snapshot(this.settings) as never);
	}

	async #reload(): Promise<void> {
		await this.#transition(false);
		await this.#loadSettings();
		await this.#transition(this.enabled);
	}

	#transition(target: boolean): Promise<void> {
		this.#transitionQueue = this.#transitionQueue.then(async () => {
			if (target) {
				if (this.status === 'active' || this.status === 'starting') {
					return;
				}

				this.status = 'starting';

				try {
					await this.enable();
					this.status = 'active';
				} catch (error) {
					console.error(`[FEATURE:${this.name}]: failed to start:`, error);
					this.status = 'error';

					try {
						await this.disable?.();
					} catch {
						// ignore cleanup errors after a failed start
					}
				}
			} else {
				if (this.status === 'disabled') {
					return;
				}

				try {
					await this.disable?.();
				} catch (error) {
					console.error(`[FEATURE:${this.name}]: failed to stop:`, error);
				}

				this.status = 'disabled';
			}
		});

		return this.#transitionQueue;
	}

	/** Disposes watchers (used by tests / teardown). */
	async destroy(): Promise<void> {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
		await this.#transition(false);
		this.#registered = false;
	}

	/**
	 * Merges imported settings with defaults without mutating the input:
	 * missing keys are filled from defaults, present keys win.
	 */
	async validateSettings(imported: Partial<Settings>): Promise<Settings> {
		const defaults = await this.defaultSettings();

		return mergeWith(
			cloneDeep(imported),
			defaults,
			(objValue: unknown, srcValue: unknown, key: string, object: unknown) => {
				const hasKey = Object.prototype.hasOwnProperty.call(object as object, key);

				// Arrays: keep imported array if present; otherwise take default
				if (Array.isArray(srcValue)) {
					return hasKey ? objValue : srcValue;
				}

				// Non-objects: only fill when missing
				if (!isPlainObject(srcValue)) {
					return hasKey ? objValue : srcValue;
				}

				// Plain objects: continue deep merge
				return undefined;
			}
		) as Settings;
	}

	/** Imports this feature's settings from a JSON file (validated). */
	async importSettings(): Promise<void> {
		try {
			const selected = await open({
				multiple: false,
				filters: [{ name: 'JSON', extensions: ['json'] }],
				defaultPath: await join(await documentDir(), `${this.name}.json`)
			});

			if (!selected || Array.isArray(selected)) {
				return;
			}

			const content = await readTextFile(selected);
			const parsed = parseFeatureImportContent(content, this.name);

			if (!parsed.success) {
				toast.error(`Import rejected: ${parsed.error}`);
				return;
			}

			const validated = await this.validateSettings(parsed.data as Partial<Settings>);

			await this.#transition(false);
			this.settings = {
				...validated,
				enabled: Boolean((validated as { enabled?: boolean }).enabled ?? false)
			};
			await this.#transition(this.enabled);

			toast.success('Settings imported successfully!');
		} catch (error) {
			console.error(`[FEATURE:${this.name}]: import failed:`, error);
			toast.error('Failed to import settings: ' + (error instanceof Error ? error.message : error));
		}
	}

	/** Exports this feature's settings as a versioned envelope. */
	async exportSettings(): Promise<void> {
		try {
			const path = await save({
				defaultPath: await join(await documentDir(), `${this.name}.json`),
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (!path) {
				return;
			}

			const envelope = createFeatureEnvelope(
				this.name,
				$state.snapshot(this.settings) as never,
				''
			);

			await writeTextFile(path, serializeEnvelope(envelope));
			toast.success('Settings exported successfully!');
		} catch (error) {
			console.error(`[FEATURE:${this.name}]: export failed:`, error);
			toast.error('Failed to export settings: ' + (error instanceof Error ? error.message : error));
		}
	}

	/** Starts the feature. */
	abstract enable(): Promise<void | this> | this | void;
}
