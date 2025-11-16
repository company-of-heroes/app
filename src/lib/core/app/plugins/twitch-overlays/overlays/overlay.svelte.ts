import { unzip } from '$lib/utils';
import { BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';

export abstract class Overlay {
	baseDir = BaseDirectory.AppData;

	abstract name: string;
	abstract path: string;

	abstract zipUrl: string;

	async register() {
		if (false === (await exists(this.path, { baseDir: this.baseDir }))) {
			await this.install();
		}
	}

	async install() {
		const path = await join(await appDataDir(), this.path);
		await unzip(this.zipUrl, path);
	}
}
