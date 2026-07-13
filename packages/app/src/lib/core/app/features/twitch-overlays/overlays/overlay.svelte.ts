import {
	BaseDirectory,
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	stat,
	writeFile,
	writeTextFile
} from '@tauri-apps/plugin-fs';
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

type DefaultSourceHash = {
	srcHash: string;
	version?: string;
};

export abstract class Overlay {
	baseDir = BaseDirectory.AppData;

	abstract name: string;
	abstract path: string;

	abstract zipUrl: string;

	version?: string;
	publishPath = 'dist';
	sourcePath = 'src';

	async register() {
		const installed = await exists(this.path, { baseDir: this.baseDir });
		if (!installed) {
			await this.install();
			await this.saveDefaultSrcHash();
			return;
		}

		if (this.version && (await this.isOutdated())) {
			if (await this.hasCustomizedSource()) {
				return;
			}

			await this.install();
			await this.saveDefaultSrcHash();
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

	async overwriteWithLatest(options: { backup?: boolean } = {}) {
		const backup = options.backup ?? true;
		const installed = await exists(this.path, { baseDir: this.baseDir });
		if (!installed) {
			await this.install();
			await this.saveDefaultSrcHash();
			return { didBackup: false, backupPath: null as string | null };
		}

		let backupPath: string | null = null;
		if (backup) {
			const stamp = new Date().toISOString().replaceAll(':', '-');
			backupPath = `${this.path}-backups/${stamp}`;
			await mkdir(backupPath, { baseDir: this.baseDir, recursive: true });

			// Do NOT zip the whole overlay directory. Users often have node_modules in there,
			// which would make the backup huge and appear like "nothing happens".
			const [srcZip, distZip] = await Promise.all([
				this.zipContent(this.sourcePath),
				this.zipContent(this.publishPath)
			]);
			await writeFile(`${backupPath}/src.zip`, srcZip, { baseDir: this.baseDir });
			await writeFile(`${backupPath}/dist.zip`, distZip, { baseDir: this.baseDir });

			// Optional: also persist the current overlay-version.json for quick inspection.
			const versionFile = `${this.path}/overlay-version.json`;
			if (await exists(versionFile, { baseDir: this.baseDir })) {
				await writeTextFile(
					`${backupPath}/overlay-version.json`,
					await readTextFile(versionFile, { baseDir: this.baseDir }),
					{ baseDir: this.baseDir }
				);
			}

			// Also capture package.json for reproducibility.
			const pkgFile = `${this.path}/package.json`;
			if (await exists(pkgFile, { baseDir: this.baseDir })) {
				await writeTextFile(
					`${backupPath}/package.json`,
					await readTextFile(pkgFile, { baseDir: this.baseDir }),
					{ baseDir: this.baseDir }
				);
			}
		}

		// Remove the current overlay directory before re-installing.
		// `recursive: true` is required for non-empty directories.
		await remove(this.path, { baseDir: this.baseDir, recursive: true });
		await this.install();
		await this.saveDefaultSrcHash();

		return { didBackup: backup, backupPath };
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

	async getPublishDirPath() {
		return join(await this.getPath(), this.publishPath);
	}

	getHostedUrl(userId: string) {
		const baseUrl = (pocketbase.baseUrl || 'https://api.coh1stats.com').replace(/\/$/, '');
		return `${baseUrl}/overlay/${userId}/`;
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

	async zipContent(subdir?: string): Promise<Uint8Array> {
		const sourcePath = await this.getPath();
		const bytes = await invoke<number[]>('zip_directory', {
			source: sourcePath,
			subdir: subdir ?? null
		});
		return Uint8Array.from(bytes);
	}

	async hashContent(subdir?: string): Promise<string> {
		const bytes = await this.zipContent(subdir);
		const digest = await crypto.subtle.digest('SHA-256', bytes);
		return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	async getLocalContentHash(): Promise<string> {
		return this.hashContent(this.publishPath);
	}

	async getDefaultSrcHash(): Promise<DefaultSourceHash | null> {
		const statePath = `${this.path}/.overlay-default-hash.json`;
		if (!(await exists(statePath, { baseDir: this.baseDir }))) {
			return null;
		}

		try {
			const content = await readTextFile(statePath, { baseDir: this.baseDir });
			return JSON.parse(content) as DefaultSourceHash;
		} catch {
			return null;
		}
	}

	async saveDefaultSrcHash() {
		const statePath = `${this.path}/.overlay-default-hash.json`;
		await writeTextFile(
			statePath,
			JSON.stringify(
				{
					srcHash: await this.hashContent(this.sourcePath),
					version: this.version
				} satisfies DefaultSourceHash,
				null,
				2
			),
			{ baseDir: this.baseDir }
		);
	}

	async hasCustomizedSource(): Promise<boolean> {
		const defaultHash = await this.getDefaultSrcHash();
		if (!defaultHash) {
			return false;
		}

		const currentHash = await this.hashContent(this.sourcePath);
		return currentHash !== defaultHash.srcHash;
	}

	async hasPendingUpdate(): Promise<boolean> {
		if (!this.version || !(await this.isOutdated())) {
			return false;
		}

		return this.hasCustomizedSource();
	}

	async hasDistBuild(): Promise<boolean> {
		return exists(`${this.path}/${this.publishPath}/index.html`, { baseDir: this.baseDir });
	}

	async #latestMtime(relativeDir: string): Promise<number | null> {
		const dirPath = `${this.path}/${relativeDir}`;
		if (!(await exists(dirPath, { baseDir: this.baseDir }))) {
			return null;
		}

		let latest = 0;

		const walk = async (current: string) => {
			const entries = await readDir(current, { baseDir: this.baseDir });
			for (const entry of entries) {
				const entryPath = `${current}/${entry.name}`;
				if (entry.isDirectory) {
					await walk(entryPath);
					continue;
				}

				if (!entry.isFile) continue;

				const info = await stat(entryPath, { baseDir: this.baseDir });
				const mtime = info.mtime?.getTime() ?? 0;
				latest = Math.max(latest, mtime);
			}
		};

		await walk(dirPath);
		return latest || null;
	}

	async isDistStale(): Promise<boolean> {
		const [srcMtime, distMtime] = await Promise.all([
			this.#latestMtime(this.sourcePath),
			this.#latestMtime(this.publishPath)
		]);

		if (srcMtime === null || distMtime === null) {
			return false;
		}

		return srcMtime > distMtime;
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

		if (!(await this.hasDistBuild())) {
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

		if (!(await this.hasDistBuild())) {
			return false;
		}

		await this.publish({ silent: true });
		return true;
	}

	async publish(options: { silent?: boolean } = {}) {
		if (!pocketbase.authStore.isValid) {
			throw new Error('You must be logged in to publish an overlay.');
		}

		if (!(await this.hasDistBuild())) {
			throw new Error('No build found. Run npm run build in the overlay folder first.');
		}

		const bytes = await this.zipContent(this.publishPath);
		const formData = new FormData();
		formData.append(
			'bundle',
			new Blob([bytes], { type: 'application/zip' }),
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
