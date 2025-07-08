import type { Component } from 'svelte';
import { app } from '$lib/state/app.svelte';
import Emittery from 'emittery';
import { watch } from 'runed';
import { createSubscriber } from 'svelte/reactivity';
import { on } from 'svelte/events';

export type ModuleInterface = {
	isForStreamer?: boolean;
	settings?: Record<string, unknown>;
};

export type ModuleEvents = {
	beforeInit: void;
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
	abstract isInitialized?: boolean;

	/**
	 * Indicates whether the module is enabled.
	 * This is reactive and will update when the settings change.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	abstract enabled: boolean;

	/**
	 * The name of the module.
	 * This is used for internal identification and should be unique.
	 *
	 * @readonly
	 * @type {string}
	 */
	abstract name: string;

	/**
	 * The name of the module as it appears in the menu.
	 *
	 * @readonly
	 * @type {string}
	 */
	abstract menuItemName: string;

	/**
	 * The Svelte component associated with this module.
	 *
	 * @readonly
	 * @type {Component}
	 */
	abstract component: Component;

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
	 * @returns {Promise<void>} A promise that resolves when the module is registered.
	 */
	register() {
		return new Promise((resolve) => {
			$effect.root(() => {
				$effect(() => {
					if (this.enabled) {
						(async () => resolve(await this.init()))();
					} else {
						(async () => resolve(await this.destroy()))();
					}
				});

				$effect(() => {
					// @ts-ignore
					if (!app.settings[this.name]) {
						// @ts-ignore
						app.settings[this.name] = this.settings;
					}

					for (const [key, value] of Object.entries(this.settings ?? {})) {
						// @ts-ignore
						app.settings[this.name][key] = value;
					}

					app.store.set('settings', app.settings);
				});

				return () => this.destroy();
			});
		});
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
