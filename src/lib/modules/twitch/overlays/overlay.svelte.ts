import { app, type App } from '$core/app';
import { appDataDir, basename, resolve } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, readDir, remove, writeFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import Emittery from 'emittery';
import slugify from 'slugify';

export type OverlayFile = {
	fileName: string;
	content?: string;
	language: string;
	icon?: string;
	onInstall?: (file: OverlayFile) => void;
};

export interface Overlay {
	init?(app: App): void;
}

export type OverlayEvents = {
	installing: never;
	init: App;
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
	 * The URL to the zip file containing the overlay files.
	 * This should point to the location where the overlay files are hosted.
	 *
	 * @type {string}
	 * @abstract
	 * @memberof Overlay
	 */
	abstract zipUrl: string;
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

		app.on('boot', () => this.emit('init', app));
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
		console.log(`Installing overlay: ${this.name}`);
		const exist = await exists(this.path, { baseDir: this.baseDir });

		if (!exist) {
			await mkdir(this.path, { baseDir: this.baseDir, recursive: true });
		}

		const request = await fetch(this.zipUrl);
		const zipData = await request.arrayBuffer();
		const filname = await basename(this.zipUrl);

		await writeFile(`${this.path}/${filname}`, new Uint8Array(zipData), {
			baseDir: this.baseDir
		});

		const path = await resolve(await appDataDir(), this.path);
		const extractCommand = Command.create('tar', ['-xf', `${path}/${filname}`, '-C', path]);

		await extractCommand.execute();
		await remove(`${path}/${filname}`);

		await this.emit('installing');
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
