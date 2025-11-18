import { watch } from 'runed';

export interface Bootable {
	shutdown?(): Promise<void>;
}

export abstract class Bootable implements Bootable {
	/**
	 * Indicates whether the bootable component has been successfully booted.
	 *
	 * @type {boolean}
	 * @default false
	 */
	isBooted = $state(false);
	/**
	 * Indicates whether the bootable component is enabled.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	abstract enabled: boolean;
	/**
	 * This method should be implemented by subclasses to perform the boot process.
	 * It is called when the application starts.
	 *
	 * @returns {Promise<void>} A promise that resolves when the boot process is complete.
	 */
	abstract boot(): Promise<this>;
}
