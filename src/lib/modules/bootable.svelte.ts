import { app } from '$lib/state/app.svelte';
import { watch } from 'runed';

export abstract class Bootable {
	/**
	 * Indicates whether the module is initialized.
	 * This is used to determine if the module should be loaded.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	abstract enabled: boolean;

	/**
	 * Constructor for the Bootable class.
	 * Initializes the module and sets up a watcher for the enabled state.
	 * If the module is enabled, it will call the init method.
	 * If the module is disabled, it will call the destroy method.
	 *
	 * @constructor
	 * @abstract
	 */
	constructor() {
		$effect.root(() => {
			watch(
				() => this.enabled,
				() => {
					if (this.enabled) {
						this.init?.();
					} else {
						this.destroy?.();
					}
				}
			);
		});

		app.on('boot', () => this.init());
	}

	/**
	 * Initializes the module.
	 * This method should be overridden by subclasses to provide specific initialization logic.
	 *
	 * @abstract
	 * @returns {Promise<void> | void} - A promise that resolves when the initialization is complete.
	 */
	abstract init(): Promise<void> | void;

	/**
	 * Cleans up the module.
	 * This method should be overridden by subclasses to provide specific cleanup logic.
	 * It is called when the module is disabled or destroyed.
	 *
	 * @abstract
	 * @returns {Promise<void> | void} - A promise that resolves when the cleanup is complete.
	 */
	abstract destroy(): Promise<void> | void;
}
