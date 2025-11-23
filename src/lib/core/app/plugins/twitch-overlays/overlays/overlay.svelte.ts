import { unzip } from '$lib/utils/unzip';
import {
	BaseDirectory,
	exists,
	mkdir,
	readDir,
	readTextFile,
	writeTextFile
} from '@tauri-apps/plugin-fs';
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

	getFiles(subPath?: string) {
		const path = subPath ? `${this.path}/${subPath}` : this.path;
		return readDir(path, { baseDir: this.baseDir });
	}

	async readFile(filePath: string) {
		const path = `${this.path}/${filePath}`;
		return readTextFile(path, { baseDir: this.baseDir });
	}

	async writeFile(filePath: string, content: string) {
		const path = `${this.path}/${filePath}`;
		return writeTextFile(path, content, { baseDir: this.baseDir });
	}

	async getPath() {
		return join(await appDataDir(), this.path);
	}
}
