import { app } from '$core/app';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
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

export abstract class Overlay implements Overlay {
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
	 * A map of file names to their content for the overlay.
	 * This will be used to create the necessary files in the overlay directory.
	 *
	 * @type {Record<string, string>}
	 * @abstract
	 * @memberof Overlay
	 */
	abstract files: OverlayFile[];

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

	/**
	 * A state variable to hold the currently selected file in the overlay.
	 * This is used to display the content of the selected file in the UI.
	 *
	 * @type {OverlayFile}
	 * @memberof Overlay
	 */
	file = $derived.by(() => this.files[0]);

	constructor() {
		$effect.root(() => {
			watch(
				() => this.file.content,
				() => {
					if (!this.file.content || this.file.content === '') {
						return;
					}

					writeTextFile(`${this.path}/${this.file.fileName}`, this.file.content || '', {
						baseDir: this.baseDir
					});
				}
			);
		});
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

		for await (const file of this.files) {
			file.content = '';
			const fileExists = await exists(`${this.path}/${file.fileName}`, {
				baseDir: this.baseDir
			});

			if (!fileExists) {
				await writeTextFile(`${this.path}/${file.fileName}`, file.content || '', {
					baseDir: this.baseDir
				});
				await file.onInstall?.(file);
			}

			file.content = await readTextFile(`${this.path}/${file.fileName}`, {
				baseDir: this.baseDir
			});
		}

		app.on('boot', () => this.init?.());

		return this;
	}

	selectFile(file: OverlayFile) {
		this.file = file;
	}

	get slug() {
		return slugify(this.name, { lower: true });
	}
}
