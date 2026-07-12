import { BaseDirectory, exists, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { pocketbase } from '$core/pocketbase';
import type { UserOverlaysResponse } from '$core/pocketbase/types';
import { fetch } from '@tauri-apps/plugin-http';
import { unzip } from '$lib/utils/unzip';
import { ClientResponseError } from 'pocketbase';

type PublishState = {
	contentHash: string;
	updatedAt: string;
	version?: string;
};

type PublishResponse = {
	success?: boolean;
	version?: string;
	updatedAt?: string;
};

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

	getHostedUrl(userId: string) {
		const baseUrl = (pocketbase.baseUrl || 'https://api.coh1stats.com').replace(/\/$/, '');
		return `${baseUrl}/overlay/${userId}`;
	}

	async getServerOverlay(): Promise<UserOverlaysResponse | null> {
		if (!pocketbase.authStore.isValid) {
			return null;
		}

		const userId = pocketbase.authStore.record?.id;
		if (!userId) {
			return null;
		}

		try {
			return await pocketbase.collection('user_overlays').getFirstListItem(`user="${userId}"`, {
				fetch
			});
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return null;
			}

			throw error;
		}
	}

	async getLocalContentHash(): Promise<string> {
		const sourcePath = await this.getPath();
		const bytes = await invoke<number[]>('zip_directory', { source: sourcePath });
		const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
		return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	async getPublishState(): Promise<PublishState | null> {
		const statePath = `${this.path}/.publish-state.json`;
		if (!(await exists(statePath, { baseDir: this.baseDir }))) {
			return null;
		}

		try {
			const content = await readTextFile(statePath, { baseDir: this.baseDir });
			return JSON.parse(content) as PublishState;
		} catch {
			return null;
		}
	}

	async savePublishState(state: PublishState) {
		const statePath = `${this.path}/.publish-state.json`;
		await writeTextFile(statePath, JSON.stringify(state, null, 2), { baseDir: this.baseDir });
	}

	async hasUnpublishedChanges(): Promise<boolean> {
		const serverOverlay = await this.getServerOverlay();
		if (!serverOverlay) {
			return false;
		}

		const publishState = await this.getPublishState();
		if (!publishState) {
			return false;
		}

		const contentHash = await this.getLocalContentHash();
		return contentHash !== publishState.contentHash;
	}

	async ensurePublished(): Promise<boolean> {
		if (!pocketbase.authStore.isValid) {
			return false;
		}

		const serverOverlay = await this.getServerOverlay();
		if (serverOverlay) {
			if (!(await this.getPublishState())) {
				await this.savePublishState({
					contentHash: await this.getLocalContentHash(),
					updatedAt: serverOverlay.updated,
					version: serverOverlay.version
				});
			}

			return false;
		}

		await this.publish({ silent: true });
		return true;
	}

	async publish(options: { silent?: boolean } = {}) {
		if (!pocketbase.authStore.isValid) {
			throw new Error('You must be logged in to publish an overlay.');
		}

		const sourcePath = await this.getPath();
		const bytes = await invoke<number[]>('zip_directory', { source: sourcePath });
		const formData = new FormData();
		formData.append(
			'bundle',
			new Blob([Uint8Array.from(bytes)], { type: 'application/zip' }),
			'overlay.zip'
		);

		const response = (await pocketbase.send('/api/overlay/publish', {
			method: 'POST',
			body: formData,
			fetch
		})) as PublishResponse;

		const contentHash = await this.getLocalContentHash();
		await this.savePublishState({
			contentHash,
			updatedAt: response.updatedAt ?? new Date().toISOString(),
			version: response.version
		});

		return response;
	}
}
