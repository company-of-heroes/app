import { error } from '@tauri-apps/plugin-log';
import { watch } from 'runed';
import { app } from '$core/app';
import { mergeWith, isPlainObject, defaultsDeep } from 'lodash-es';
import Emittery from 'emittery';
import type { Component } from 'svelte';

export interface Plugin<
	Settings extends Record<string, unknown> | { enabled: boolean } = { enabled: boolean }
> {
	defaultSettings(): Settings;
}

export abstract class Plugin<
	Settings extends Record<string, unknown> | { enabled: boolean } = { enabled: boolean },
	Events = {},
	Props extends Record<string, any> = {}
> extends Emittery<Events> {
	/**
	 * The name of the plugin.
	 *
	 * @type {string}
	 */
	abstract name: string;

	/**
	 * Indicates whether the plugin is enabled.
	 *
	 * @type {boolean}
	 * @default false
	 */
	enabled = $derived.by(() => this.settings.enabled);

	/**
	 * The settings for the plugin.
	 *
	 * @type {Settings}
	 * @default undefined
	 */
	settings = $state({ enabled: true }) as Settings & { enabled: boolean };

	/**
	 * The components associated with the plugin.
	 *
	 * @type {{ component: Component<Props>; props?: Props }[]}
	 * @default []
	 */
	components: { component: Component<Props>; props?: Props }[] = $state([]);

	/**
	 * Adds a component to the plugin's component list.
	 *
	 * @param {Component<Props>} component - The Svelte component to add.
	 * @param {Props} [props] - Optional props to pass to the component.
	 */
	addComponent(component: Component<Props>, props?: Props) {
		this.components.push({ component, props });
	}

	/**
	 * Registers the plugin with the application.
	 *
	 * @returns {Promise<Plugin<Settings>>} A promise that resolves to the registered plugin.
	 */
	async register() {
		return new Promise(async (resolve) => {
			let settings = await app.store.get<Settings>(`plugin.${this.name}`);

			if (!settings) {
				this.settings = { ...this.defaultSettings?.(), enabled: true };
			} else {
				this.settings = defaultsDeep(
					settings as Settings & { enabled: boolean },
					this.defaultSettings?.()
				);
			}

			$effect.root(() => {
				watch(
					() => this.enabled,
					() => {
						(async () => {
							this.settings.enabled = this.enabled;
							console.log(this.enabled);

							if (this.enabled) {
								try {
									await this.enable();
								} catch (e) {
									error(`Error initializing module ${this.constructor.name}: ${e}`);
									await this._disable();
								}
							} else {
								await this._disable();
							}

							return resolve(this);
						})();
					}
				);

				watch(
					() => $state.snapshot(this.settings),
					() => {
						app.store.set(`plugin.${this.name}`, this.settings);
						app.store.save();
					}
				);

				return () => this.disable();
			});
		});
	}

	/**
	 * Validates and merges the provided settings with the default settings.
	 *
	 * @param {Partial<Settings>} settings - The settings to validate.
	 * @returns {Settings} The validated and merged settings.
	 */
	validateSettings(settings: Partial<Settings>): Settings {
		const defaults = this.defaultSettings();

		return mergeWith(settings, defaults, (objValue, srcValue, key, object) => {
			const hasKey = Object.prototype.hasOwnProperty.call(object as object, key as string);

			// Arrays: keep existing array if present; otherwise take default
			if (Array.isArray(srcValue)) {
				return hasKey ? objValue : srcValue;
			}

			// Non-objects (primitives, null, functions, dates, etc.): only set if key missing
			if (!isPlainObject(srcValue)) {
				return hasKey ? objValue : srcValue;
			}

			// For plain objects, continue deep merge so inner missing keys get filled
			return undefined;
		});
	}

	/**
	 * Disables the plugin internally.
	 */
	private async _disable() {
		await this.disable();
	}

	/**
	 * Enables the pluggable feature.
	 *
	 * @abstract
	 * @returns {Promise<void | this>} A promise that resolves when the feature is enabled.
	 */
	abstract enable(): Promise<void | this>;

	/**
	 * Disables the pluggable feature.
	 *
	 * @abstract
	 * @returns {Promise<void>} A promise that resolves when the feature is disabled.
	 */
	abstract disable(): Promise<void>;
}
