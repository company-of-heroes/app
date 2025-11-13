import { Module } from '$lib/modules/module.svelte';

export class Replays extends Module {
	enabled = $state(true);

	name = 'replays';

	isInitialized = $state(false);

	init(): void {
		throw new Error('Method not implemented.');
	}

	destroy(): void {
		throw new Error('Method not implemented.');
	}
}

// import { parseReplay, parseReplayFile, type ParsedReplay } from '$core/replay-analyzer';
// import { readDir, readFile, stat, type DirEntry, type FileInfo } from '@tauri-apps/plugin-fs';
// import { app } from './app.svelte';
// import { orderBy, throttle } from 'lodash-es';
// import { page } from '$app/state';
// import ReplayWorker from '$lib/workers/replay.worker?worker';

// export class Replays {
// 	/**
// 	 *
// 	 * This worker is used to parse replay files in a separate thread
// 	 * to avoid blocking the main thread during heavy parsing operations.
// 	 *
// 	 * This allows for better performance and responsiveness in the application,
// 	 * especially when dealing with many replay files.
// 	 *
// 	 * @public
// 	 * @type {Worker}
// 	 */
// 	worker = new ReplayWorker();

// 	/**
// 	 * Reactive array holding the application's replay files.
// 	 *
// 	 * @public
// 	 * @type {string[]}
// 	 */
// 	files: (FileInfo & DirEntry)[] = $state([]);

// 	/**
// 	 * Path to the replays directory.
// 	 *
// 	 * @public
// 	 * @type {string}
// 	 */
// 	path = $derived(app?.settings.companyOfHeroesConfigPath + '/playback');

// 	/**
// 	 * Reactive array holding the parsed replay data.
// 	 *
// 	 * @public
// 	 * @type {ParsedReplay[]}
// 	 */
// 	replays: ParsedReplay[] = $state([]);

// 	/**
// 	 * Reactive array holding the filtered replays based on user selections.
// 	 *
// 	 * @public
// 	 * @type {ParsedReplay[]}
// 	 */
// 	filtered: ParsedReplay[] = $state([]);

// 	/**
// 	 * Indicates whether the replay loading process is currently active.
// 	 *
// 	 * @public
// 	 * @type {boolean}
// 	 */
// 	isLoading = $state(false);

// 	/**
// 	 * Stores the current processing progress (0-100).
// 	 *
// 	 * @public
// 	 * @type {number}
// 	 */
// 	progress = $state(0);

// 	/**
// 	 * Interval ID for the current batch processing operation.
// 	 *
// 	 * @private
// 	 * @type {NodeJS.Timeout | null}
// 	 */
// 	private processingInterval: NodeJS.Timeout | null = null;

// 	/**
// 	 * Reactive property that holds the currently selected replay.
// 	 * This is derived from the current page parameters.
// 	 *
// 	 * @public
// 	 * @type {ParsedReplay | null}
// 	 */
// 	current: ParsedReplay | null = $derived.by(() => {
// 		return this.replays.find((replay) => replay.fileName === page.params.fileName) || null;
// 	});

// 	/**
// 	 * Asynchronously loads replay files from the specified directory,
// 	 * parses them, and updates the reactive state.
// 	 *
// 	 * @public
// 	 * @returns {Promise<void>}
// 	 */
// 	async load() {
// 		// Prevent multiple simultaneous load operations
// 		if (this.isLoading) {
// 			console.warn('Replay loading already in progress, skipping...');
// 			return;
// 		}

// 		this.isLoading = true;
// 		this.progress = 0;

// 		try {
// 			const entries = await readDir(this.path);
// 			const replayFilesWithMetadata = await Promise.all(
// 				entries
// 					.filter((entry) => entry.isFile && !entry.isSymlink && entry.name.endsWith('.rec'))
// 					.slice(0, 1000)
// 					.map(async (file) => {
// 						const fileStats = await stat(`${this.path}/${file.name}`);
// 						return { ...file, ...fileStats };
// 					})
// 			);

// 			// Sort by modification time (newest first) for better user experience
// 			replayFilesWithMetadata.sort((a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0));

// 			await this.processBatchedReplays(replayFilesWithMetadata);
// 		} catch (error) {
// 			console.error('Error loading replays:', error);
// 		} finally {
// 			this.isLoading = false;
// 			this.progress = 100;
// 		}
// 	}

// 	/**
// 	 * Processes replay files in batches to prevent system overload.
// 	 *
// 	 * @private
// 	 * @param {(FileInfo & DirEntry)[]} files - Array of replay files to process
// 	 * @returns {Promise<void>}
// 	 */
// 	private async processBatchedReplays(files: (FileInfo & DirEntry)[]): Promise<void> {
// 		const batchSize = 25; // Reduced batch size for better performance
// 		const processingDelay = 750; // Increased delay between batches
// 		const amount = files.length;
// 		let start = 0;
// 		let isBusy = false;

// 		// Clear any existing processing interval
// 		if (this.processingInterval) {
// 			clearInterval(this.processingInterval);
// 		}

// 		// Reset arrays at the start
// 		this.replays = [];
// 		this.filtered = [];

// 		const processBatch = async () => {
// 			if (isBusy || start >= amount) return;

// 			isBusy = true;
// 			const end = Math.min(start + batchSize, amount);
// 			const batchFiles = files.slice(start, end);
// 			const batchReplays: ParsedReplay[] = [];

// 			try {
// 				// Process files in parallel within the batch for better performance
// 				const parsePromises = batchFiles.map(async (file) => {
// 					try {
// 						const data = await readFile(`${this.path}/${file.name}`);
// 						return parseReplay(data, file.name);
// 					} catch (error) {
// 						console.error(`Error parsing replay ${file.name}:`, error);
// 						return null;
// 					}
// 				});

// 				const results = await Promise.all(parsePromises);
// 				batchReplays.push(...results.filter((replay): replay is ParsedReplay => replay !== null));

// 				// Update state with new replays
// 				this.replays = [...this.replays, ...batchReplays];
// 				this.filtered = [...this.filtered, ...batchReplays];

// 				// Update progress
// 				this.progress = Math.round((end / amount) * 100);

// 				start = end;
// 				console.log(`Processed ${end} of ${amount} replays (${this.progress}%)`);
// 			} catch (error) {
// 				console.error('Error processing batch:', error);
// 			} finally {
// 				isBusy = false;
// 			}
// 		};

// 		// Use a more controlled interval approach
// 		this.processingInterval = setInterval(async () => {
// 			if (start >= amount) {
// 				if (this.processingInterval) {
// 					clearInterval(this.processingInterval);
// 					this.processingInterval = null;
// 				}
// 				console.log('Replay processing completed');
// 				return;
// 			}

// 			if (!isBusy) {
// 				await processBatch();
// 			}
// 		}, processingDelay);
// 	}

// 	/**
// 	 * Stops the current replay loading process.
// 	 *
// 	 * @public
// 	 * @returns {void}
// 	 */
// 	stopLoading(): void {
// 		if (this.processingInterval) {
// 			clearInterval(this.processingInterval);
// 			this.processingInterval = null;
// 		}
// 		this.isLoading = false;
// 	}

// 	/**
// 	 * Cleanup method to be called when the component is destroyed.
// 	 *
// 	 * @public
// 	 * @returns {void}
// 	 */
// 	destroy(): void {
// 		this.stopLoading();
// 		this.worker.terminate();
// 	}
// }

// export const replays = new Replays();
