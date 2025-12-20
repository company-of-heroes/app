import { app } from '$core/app';
import { readDir, readFile, stat, type DirEntry, type FileInfo } from '@tauri-apps/plugin-fs';
import { Feature } from '../feature.svelte';
import { dirname, join } from '@tauri-apps/api/path';
import { orderBy } from 'lodash-es';
import ReplayWorker from '$lib/workers/replay.worker?worker';

export type ReplayAnalyzerSettings = {
	didDoInitialScan: boolean;
	ignoredFiles: string[];
};

export class ReplayAnalyzer extends Feature<ReplayAnalyzerSettings> {
	name = 'replay-analyzer';

	progress = $state({
		total: 0,
		processed: 0,
		isScanning: false
	});

	private worker: Worker | null = null;
	private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
	private idCounter = 0;

	defaultSettings() {
		return {
			enabled: true,
			didDoInitialScan: false,
			ignoredFiles: []
		};
	}

	enable() {
		this.worker = new ReplayWorker();
		this.setupWorkerListeners();

		this.scanReplays().catch((err) => {
			console.error('ReplayAnalyzer: Scan failed', err);
			this.progress.isScanning = false;
		});
	}

	disable() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}

	private setupWorkerListeners() {
		if (!this.worker) return;

		this.worker.onmessage = (event) => {
			const { id, success, replay, content, error } = event.data;
			const p = this.pending.get(id);

			if (p) {
				this.pending.delete(id);

				if (success) {
					p.resolve({ replay, content });
				} else {
					p.reject(error);
				}
			}
		};
	}

	private async scanReplays() {
		const playbackDir = await this.getPlaybackDir();
		if (!playbackDir) return;

		this.progress.isScanning = true;

		try {
			const replays = await this.getReplaysToProcess(playbackDir);

			if (replays.length === 0) {
				return;
			}

			this.progress.total = replays.length;
			this.progress.processed = 0;

			await this.processQueue(replays, playbackDir);

			this.settings.didDoInitialScan = true;
		} finally {
			this.progress.isScanning = false;
		}
	}

	private async processQueue(replays: string[], playbackDir: string) {
		const CONCURRENCY = 2;
		const queue = [...replays];
		const activePromises = new Set<Promise<void>>();

		while (queue.length > 0 || activePromises.size > 0) {
			while (queue.length > 0 && activePromises.size < CONCURRENCY) {
				const filename = queue.shift()!;
				const promise = this.processReplay(filename, playbackDir).finally(() => {
					this.progress.processed++;
					activePromises.delete(promise);
				});
				activePromises.add(promise);
			}

			if (activePromises.size > 0) {
				await Promise.race(activePromises);
			}
		}
	}

	private async getPlaybackDir(): Promise<string | null> {
		if (!app.settings.companyOfHeroesConfigPath) {
			console.warn('ReplayAnalyzer: CoH config path not set.');
			return null;
		}

		const configDir = await dirname(app.settings.companyOfHeroesConfigPath);
		return await join(configDir, 'playback');
	}

	private async getReplaysToProcess(playbackDir: string): Promise<string[]> {
		let localFiles: (DirEntry & FileInfo)[] = [];
		try {
			const files = await readDir(playbackDir);

			localFiles = await Promise.all(
				files.map(async (f) => {
					const info = await stat(await join(playbackDir, f.name));
					return { ...f, ...info };
				})
			);

			localFiles = orderBy(localFiles, 'birthtime', 'desc');
		} catch (e) {
			console.warn(`ReplayAnalyzer: Could not read playback directory: ${playbackDir}`, e);
			return [];
		}

		const replays = localFiles
			.filter(
				(f) =>
					f.isFile &&
					f.name.endsWith('.rec') &&
					f.name !== 'temp.rec' &&
					!f.name.startsWith('replay_')
			)
			.map((f) => f.name);

		const existingFilenames = await app.database.replays().getExistingFilenamesByUser();
		const existingSet = new Set(existingFilenames);

		const newReplays = replays
			.filter((name) => !existingSet.has(name))
			.filter((name) => !this.settings.ignoredFiles.includes(name));

		console.log(`Found ${newReplays.length} new replays to process.`);
		return newReplays;
	}

	private async processReplay(filename: string, playbackDir: string) {
		try {
			const filePath = await join(playbackDir, filename);
			const content = await readFile(filePath);
			await this.processReplayInWorker(content, filename);
		} catch (err) {
			this.settings.ignoredFiles.push(filename);
			console.error(`ReplayAnalyzer: Error processing ${filename}`, err);
		}
	}

	private processReplayInWorker(content: Uint8Array, fileName: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Worker not initialized'));
				return;
			}
			const id = this.idCounter++;
			this.pending.set(id, { resolve, reject });
			this.worker.postMessage(
				{
					type: 'process',
					id,
					content,
					fileName,
					userId: app.features.auth.userId,
					pbUrl: app.pocketbase.baseUrl,
					authToken: app.pocketbase.authStore.token
				},
				[content.buffer]
			);
		});
	}
}

export const replayAnalyzer = new ReplayAnalyzer();
