import type { Component } from 'svelte';
import { app } from '$core/app';
import Emittery from 'emittery';
import { watch } from 'runed';
import { error } from '@tauri-apps/plugin-log';

export type ModuleInterface = {
	isForStreamer?: boolean;
	settings?: Record<string, unknown>;
};

export type ModuleEvents = {
	beforeInit: never;
	afterInit: { app: typeof app; module: Module };
};

export abstract class Module extends Emittery<ModuleEvents> implements ModuleInterface {
	/**
	 * Indicates whether the module is for streamers.
	 *
	 * @readonly
	 * @type {boolean}
	 * @default false
	 */
	isForStreamer = $state(false);

	/**
	 * Indicates whether the module is initialized.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	isInitialized: boolean = $state(false);

	/**
	 * Indicates whether the module is enabled.
	 * This is reactive and will update when the settings change
	 *
	 * @readonly
	 * @type {boolean}
	 */
	abstract enabled: boolean;

	/**
	 * Settings for the module.
	 * These should be configurable in the UI.
	 *
	 * @readonly
	 * @type {Record<string, unknown>}
	 */
	readonly settings?: Record<string, unknown> | undefined = $derived({});

	/**
	 * Registers the module within the app.
	 * This method sets up a reactive effect to initialize the module when enabled.
	 *
	 * @returns {Promise<this>} A promise that resolves when the module is registered.
	 */
	register(): Promise<this> {
		return new Promise((resolve) => {
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
