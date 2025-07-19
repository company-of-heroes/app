import { ReplayParser, type Replay } from '$core/replay-analyzer';
import { readDir, stat, type DirEntry, type FileInfo } from '@tauri-apps/plugin-fs';
import { app } from './app.svelte';
import { orderBy } from 'lodash-es';
import { page } from '$app/state';

export class Replays {
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
	path = $derived(app.settings.companyOfHeroesConfigPath + '/playback');

	/**
	 * Reactive array holding the parsed replay data.
	 *
	 * @public
	 * @type {Replay[]}
	 */
	replays: Replay[] = $state([]);

	/**
	 * Reactive property that holds the currently selected replay.
	 * This is derived from the current page parameters.
	 *
	 * @public
	 * @type {Replay | null}
	 */
	current: Replay | null = $derived.by(() => {
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
		const replayFiles = entries
			.filter((file) => file.isFile && !file.isSymlink && file.name.endsWith('.rec'))
			.slice(0, 10);

		this.files = await Promise.all(
			replayFiles.map(async (file) => {
				const fileStat = await stat(`${this.path}/${file.name}`);
				return { ...file, ...fileStat };
			})
		);

		this.replays = await Promise.all(
			this.files.map(async (file) => {
				const replay = await ReplayParser.parse(`${this.path}/${file.name}`);
				return replay;
			})
		);
		this.replays = orderBy(this.replays, ['birthtime'], ['desc']);
	}
}

export const replays = new Replays();
