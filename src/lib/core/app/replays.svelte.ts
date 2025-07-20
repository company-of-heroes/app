import { parseReplayFile, type ParsedReplay } from '$core/replay-analyzer';
import { readDir, readFile, stat, type DirEntry, type FileInfo } from '@tauri-apps/plugin-fs';
import { app } from './app.svelte';
import { orderBy } from 'lodash-es';
import { page } from '$app/state';
import ReplayWorker from '$lib/workers/replay.worker?worker';

export class Replays {
	/**
	 *
	 * This worker is used to parse replay files in a separate thread
	 * to avoid blocking the main thread during heavy parsing operations.
	 *
	 * This allows for better performance and responsiveness in the application,
	 * especially when dealing with many replay files.
	 *
	 * @public
	 * @type {Worker}
	 */
	worker = new ReplayWorker();

	/**
	 * Reactive array holding the application's replay files.
	 *
	 * @public
	 * @type {string[]}
	 */
	files: (FileInfo & DirEntry)[] = $state([]);

	/**
	 * Path to the replays directory.
	 *
	 * @public
	 * @type {string}
	 */
	path = $derived(app?.settings.companyOfHeroesConfigPath + '/playback');

	/**
	 * Reactive array holding the parsed replay data.
	 *
	 * @public
	 * @type {ParsedReplay[]}
	 */
	replays: ParsedReplay[] = $state([]);

	/**
	 * Reactive array holding the filtered replays based on user selections.
	 *
	 * @public
	 * @type {ParsedReplay[]}
	 */
	filtered: ParsedReplay[] = $state([]);

	/**
	 * Reactive property that holds the currently selected replay.
	 * This is derived from the current page parameters.
	 *
	 * @public
	 * @type {ParsedReplay | null}
	 */
	current: ParsedReplay | null = $derived.by(() => {
		return this.replays.find((replay) => replay.fileName === page.params.fileName) || null;
	});

	/**
	 * Asynchronously loads replay files from the specified directory,
	 * parses them, and updates the reactive state.
	 *
	 * @public
	 * @returns {Promise<void>}
	 */
	async load() {
		const entries = await readDir(this.path);
		const replayFiles = entries.filter(
			(file) => file.isFile && !file.isSymlink && file.name.endsWith('.rec')
		);

		this.worker.postMessage({ name: 'init', fileName: replayFiles[0].name, path: this.path });
		// console.time('Loading replays');
		// const replayFilesWithStats = await Promise.all(
		// 	replayFiles.map(async (file) => {
		// 		const fileStat = await stat(`${this.path}/${file.name}`);
		// 		return { ...file, ...fileStat };
		// 	})
		// );
		// this.files = orderBy(replayFilesWithStats, ['birthtime'], ['desc']);
		// const files = await Promise.all(
		// 	this.files.map((file) => readFile(`${this.path}/${file.name}`))
		// );
		// this.worker.addEventListener('message', (event: MessageEvent<{ replay: ParsedReplay }>) => {
		// 	this.replays.push(event.data.replay);
		// 	this.filtered.push(event.data.replay);
		// });
		// console.timeEnd('Loading replays');
		//this.replays.forEach(replay => )
		//console.log(files);
		///this.worker.postMessage(replayFilesWithStats);
		// this.files.slice(0, 10).forEach(async (file) => {
		// 	try {
		// 		const replay = await parseReplayFile(`${this.path}/${file.name}`);
		// 		console.log(replay);
		// 		this.replays.push(replay);
		// 		this.filtered.push(replay);
		// 	} catch (error) {
		// 		console.warn(`Skipped ${file.name}:`, error);
		// 	}
		// });
	}
}

export const replays = new Replays();
