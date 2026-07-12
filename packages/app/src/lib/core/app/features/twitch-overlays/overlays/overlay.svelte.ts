import { BaseDirectory, exists, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join, appDataDir, tempDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { readFile, remove } from '@tauri-apps/plugin-fs';
import { pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { unzip } from '$lib/utils/unzip';

export abstract class Overlay {
	baseDir = BaseDirectory.AppData;

	abstract name: string;
	abstract path: string;

	abstract zipUrl: string;

	version?: string;

	async register() {
		const installed = await exists(this.path, { baseDir: this.baseDir });
		if (!installed || (this.version && (await this.isOutdated()))) {
			await this.install();
		}
	}

	async isOutdated(): Promise<boolean> {
		if (!this.version) return false;

		const versionPath = `${this.path}/overlay-version.json`;
		if (!(await exists(versionPath, { baseDir: this.baseDir }))) {
			return true;
		}

		try {
			const content = await readTextFile(versionPath, { baseDir: this.baseDir });
			const { version } = JSON.parse(content) as { version?: string };
			return version !== this.version;
		} catch {
			return true;
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

	async publish() {
		if (!pocketbase.authStore.isValid) {
			throw new Error('You must be logged in to publish an overlay.');
		}

		const sourcePath = await this.getPath();
		const zipPath = await join(await tempDir(), `overlay-${Date.now()}.zip`);

		try {
			await invoke('zip_directory', { source: sourcePath, destination: zipPath });
			const bytes = await readFile(zipPath);
			const formData = new FormData();
			formData.append('bundle', new Blob([bytes], { type: 'application/zip' }), 'overlay.zip');

			return await pocketbase.send('/api/overlay/publish', {
				method: 'POST',
				body: formData,
				fetch
			});
		} finally {
			try {
				await remove(zipPath);
			} catch {
				// ignore cleanup errors
			}
		}
	}

	getHostedUrl(userId: string) {
		const baseUrl = (pocketbase.baseUrl || 'https://api.coh1stats.com').replace(/\/$/, '');
		return `${baseUrl}/overlay/${userId}`;
	}
}
