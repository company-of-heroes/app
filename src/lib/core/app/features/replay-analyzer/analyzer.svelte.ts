import { app } from '$core/app';
import { readDir, readFile, stat, type DirEntry, type FileInfo } from '@tauri-apps/plugin-fs';
import { Feature } from '../feature.svelte';
import { dirname, join } from '@tauri-apps/api/path';
import dayjs from '$lib/dayjs';
import { orderBy } from 'lodash-es';
import ReplayWorker from '$lib/workers/replay.worker?worker';

const DATE_FORMATS = [
	'DD/MM/YYYY HH:mm',
	'D/M/YYYY HH:mm',
	'DD/M/YYYY HH:mm',
	'D/MM/YYYY HH:mm',
	'DD-MM-YYYY HH:mm',
	'D-M-YYYY HH:mm',
	'DD-M-YYYY HH:mm',
	'D-MM-YYYY HH:mm',
	'MM/DD/YYYY HH:mm',
	'M/D/YYYY HH:mm',
	'MM-DD-YYYY HH:mm',
	'M-D-YYYY HH:mm',
	'YYYY-MM-DD HH:mm',
	'YYYY/MM/DD HH:mm',
	'DD/MM/YYYY h:mm A',
	'D/M/YYYY h:mm A',
	'DD/MM/YYYY h:mm a',
	'D/M/YYYY h:mm a',
	'MM/DD/YYYY h:mm A',
	'M/D/YYYY h:mm A',
	'MM/DD/YYYY h:mm a',
	'M/D/YYYY h:mm a',
	'DD-MM-YYYY h:mm A',
	'D-M-YYYY h:mm A',
	'DD-MM-YYYY h:mm a',
	'D-M-YYYY h:mm a',
	'DD-MMM-YY h:mm A',
	'DD-MMM-YY h:mm a'
];

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
		this.worker.onmessage = (event) => {
			const { id, success, replay, content, error } = event.data;
			const p = this.pending.get(id);
			if (p) {
				this.pending.delete(id);
				if (success) p.resolve({ replay, content });
				else p.reject(error);
			}
		};

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

	private parseReplayInWorker(
		content: Uint8Array,
		fileName: string
	): Promise<{ replay: any; content: Uint8Array }> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Worker not initialized'));
				return;
			}
			const id = this.idCounter++;
			this.pending.set(id, { resolve, reject });
			this.worker.postMessage({ id, content, fileName }, [content.buffer]);
		});
	}

	private async scanReplays() {
		const playbackDir = await this.getPlaybackDir();
		if (!playbackDir) return;

		this.progress.isScanning = true;
		const replays = await this.getReplaysToProcess(playbackDir);

		if (replays.length === 0) {
			this.progress.isScanning = false;
			return;
		}

		this.progress.total = replays.length;
		this.progress.processed = 0;

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

		this.settings.didDoInitialScan = true;
		this.progress.isScanning = false;
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

		let replays = localFiles
			.filter(
				(f) =>
					f.isFile &&
					f.name.endsWith('.rec') &&
					f.name !== 'temp.rec' &&
					f.name.startsWith('replay_')
			)
			.map((f) => f.name);

		const existingFilenames = await app.database.replays().getExistingFilenames();
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
			const replayFile = await readFile(filePath);
			const { replay, content } = await this.parseReplayInWorker(replayFile, filename);

			console.log({
				durationInSeconds: replay.duration,
				file: new File([new Uint8Array(content)], filename),
				filename: filename,
				gameDate: dayjs(replay.gameDate, DATE_FORMATS).toISOString(),
				isHighResources: replay.highResources,
				isRandomStart: replay.randomStart,
				mapFilename: replay.mapFileName,
				mapName: replay.mapName,
				isRanked: replay.matchType?.toLowerCase().includes('automatch') ?? false,
				isVpGame: replay.vpGame,
				vpCount: replay.vpCount,
				players: replay.players,
				messages: replay.messages,
				title: !replay.replayName ? '-' : replay.replayName
			});

			await app.database.replays().create({
				durationInSeconds: replay.duration,
				file: new File([new Uint8Array(content)], filename),
				filename: filename,
				gameDate: dayjs(replay.gameDate, DATE_FORMATS).toISOString(),
				isHighResources: replay.highResources,
				isRandomStart: replay.randomStart,
				mapFilename: replay.mapFileName,
				mapName: replay.mapName,
				isRanked: replay.matchType?.toLowerCase().includes('automatch') ?? false,
				isVpGame: replay.vpGame,
				vpCount: replay.vpCount,
				players: replay.players,
				messages: replay.messages,
				title: !replay.replayName ? '-' : replay.replayName
			});
		} catch (err) {
			this.settings.ignoredFiles.push(filename);
			console.error(`ReplayAnalyzer: Error processing ${filename}`, err);
		}
	}
}

export const replayAnalyzer = new ReplayAnalyzer();
