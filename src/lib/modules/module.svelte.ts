import type { Component } from 'svelte';
import { app } from '$core/app';
import Emittery from 'emittery';
import { watch } from 'runed';
import { error } from '@tauri-apps/plugin-log';

export type ModuleEvents<Settings extends Record<string, unknown> | undefined> = {
	beforeInit: never;
	afterInit: { app: typeof app; module: Module<Settings> };
};

export interface Module<Settings extends Record<string, unknown> | undefined = undefined> {
	defaultSettings(): Settings;
}

export abstract class Module<Settings extends Record<string, unknown> | undefined = undefined>
	extends Emittery<ModuleEvents<Settings>>
	implements Module<Settings>
{
	/**
	 * Indicates whether the module is for streamers.
	 *
	 * @type {boolean}
	 * @default false
	 */
	isForStreamer = $state(false);

	/**
	 * Indicates whether the module is initialized.
	 *
	 * @type {boolean}
	 * @default false
	 */
	isInitialized: boolean = $state(false);

	/**
	 * The settings for the module.
	 *
	 * @type {Settings}
	 * @default undefined
	 */
	settings: Settings = $state(undefined) as Settings;

	/**
	 * Indicates whether the module is pluggable.
	 *
	 * @type {boolean}
	 * @default false
	 */
	pluggable = false;

	/**
	 * Indicates whether the module is enabled.
	 *
	 * @type {boolean}
	 */
	enabled = $derived.by(
		() => !!(this.pluggable && this.settings !== undefined && (this.settings as any).enabled)
	);

	/**
	 * The name of the module.
	 *
	 * @abstract
	 * @type {string}
	 */
	abstract name: string;

	/**
	 * Registers the module within the app.
	 * This method sets up a reactive effect to initialize the module when enabled.
	 *
	 * @returns {Promise<this>} A promise that resolves when the module is registered.
	 */
	register(): Promise<this> {
		return new Promise(async (resolve) => {
			this.settings = (await app.store.get<Settings>(this.name)) as Settings;

			if (!this.settings) {
				this.settings = this.defaultSettings?.();
			}

			$effect.root(() => {
				watch(
					() => this.enabled,
					() => {
						if (this.enabled) {
							try {
								(async () => await this._init())();
							} catch (e) {
								error(`Error initializing module ${this.constructor.name}: ${JSON.stringify(e)}`);
								(async () => await this._destroy())();
							}
						} else {
							(async () => await this._destroy())();
						}

						return resolve(this);
					}
				);

				watch(
					() => $state.snapshot(this.settings),
					() => {
						app.store.set(this.name, this.settings);
						app.store.save();
					}
				);

				return () => this.destroy();
			});
		});
	}

	/**
	 * Initializes the module internally.
	 * This method emits lifecycle events before and after initialization.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async _init() {
		await this.emit('beforeInit');
		await this.init();
		await this.emit('afterInit', { app, module: this });

		this.isInitialized = true;
	}

	/**
	 * Cleans up the module internally.
	 * This method emits lifecycle events before and after destruction.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async _destroy() {
		await this.destroy();
		this.isInitialized = false;
	}

	/**
	 * Initializes the module.
	 * This method should be overridden in subclasses to provide specific initialization logic.
	 * It is called when the module is enabled.
	 *
	 * @abstract
	 * @public
	 * @returns {this}
	 */
	abstract init(): void;

	/**
	 * Cleans up the module.
	 * This method should be overridden in subclasses to provide specific cleanup logic.
	 * It is called when the module is disabled or destroyed.
	 *
	 * @abstract
	 * @public
	 * @returns {void}
	 */
	abstract destroy(): void;
}
