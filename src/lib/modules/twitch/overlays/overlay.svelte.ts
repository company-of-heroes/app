import { app } from '$core/app';
import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
	readDir
} from '@tauri-apps/plugin-fs';
import Emittery from 'emittery';
import { watch } from 'runed';
import slugify from 'slugify';

export type OverlayFile = {
	fileName: string;
	content?: string;
	language: string;
	icon?: string;
	onInstall?: (file: OverlayFile) => void;
};

export interface Overlay {
	init?(): void;
}

export type OverlayEvents = {
	'overlay:installed': never;
};

export abstract class Overlay extends Emittery<OverlayEvents> implements Overlay {
	/**
	 * The base directory where the overlay files will be stored.
	 * This is set to the app's data directory.
	 *
	 * @type {BaseDirectory}
	 * @memberof Overlay
	 */
	baseDir = BaseDirectory.AppData;
	/**
	 * The name of the overlay.
	 * This should be a unique identifier for the overlay.
	 *
	 * @type {string}
	 * @abstract
	 * @memberof Overlay
	 */
	abstract name: string;
	/**
	 * The path where the overlay files will be stored.
	 * This should be a relative path from the app's data directory.
	 *
	 * @type {string}
	 * @abstract
	 * @memberof Overlay
	 */
	abstract path: string;
	/**
	 * A derived property that indicates whether the overlay is currently active.
	 * It checks if the current overlay instance is the one loaded in the app.
	 *
	 * @type {boolean}
	 * @memberof Overlay
	 */
	isActive = $derived.by(() => {
		return this === app.getModule('twitch').overlays.overlay;
	});

	constructor() {
		super();

		// $effect.root(() => {
		// 	watch(
		// 		() => this.file.content,
		// 		() => {
		// 			if (!this.file.content || this.file.content === '') {
		// 				return;
		// 			}

		// 			writeTextFile(`${this.path}/${this.file.fileName}`, this.file.content || '', {
		// 				baseDir: this.baseDir
		// 			});
		// 		}
		// 	);
		// });

		app.on('boot', () => this.init?.());
	}

	/**
	 * Initializes the overlay by reading the content of the files.
	 * This is called when the app boots up.
	 *
	 * @memberof Overlay
	 * @return {Promise<void>} A promise that resolves when the overlay is initialized.
	 */
	async activate() {
		return this;
	}

	/**
	 * Installs the overlay by creating the necessary directory and files.
	 *
	 * @return {Promise<Overlay>} A promise that resolves to the installed overlay instance.
	 */
	async install() {
		const exist = await exists(this.path, { baseDir: this.baseDir });

		if (!exist) {
			await mkdir(this.path, { baseDir: this.baseDir });
		}

		this.emit('overlay:installed');
		return this;
	}

	getFiles() {
		return readDir(this.path, { baseDir: this.baseDir });
	}

	isInstalled() {
		return exists(this.path, { baseDir: this.baseDir });
	}

	get slug() {
		return slugify(this.name, { lower: true });
	}
}
