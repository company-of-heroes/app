import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import {
	exists,
	readDir,
	readFile,
	remove,
	rename,
	stat,
	watch,
	writeFile
} from '@tauri-apps/plugin-fs';
import { load, type Store } from '@tauri-apps/plugin-store';
import { setReplayName } from '@fknoobs/replay-parser';
import { normalizeMapName } from '@company-of-heroes/ui/format/player-format';
import { toast } from '@company-of-heroes/ui/toasts';
import { Context } from 'runed';
import { t } from '$lib/i18n';
import { mapKey } from '$lib/media';
import { summarizeReplayAsync } from './summarize-async';
import type { FactionKey, ReplayEntry, ReplaySummary } from './types';

export type ReplayPeriod = 'all' | 'week' | 'month' | 'year';
export type ReplaySort = 'newest' | 'oldest' | 'longest' | 'name';

const INVALID_FILE_NAME = /[\\/:*?"<>|]/;
const PERIOD_DAYS: Record<Exclude<ReplayPeriod, 'all'>, number> = { week: 7, month: 30, year: 365 };

type CohPaths = { playbackDir: string | null };
type CacheEntry = { size: number; modified: number; summary: ReplaySummary };

export function replayTitle(entry: ReplayEntry): string {
	return entry.summary?.replayName || entry.fileName.replace(/\.rec$/i, '');
}

export function replayMapLabel(summary: ReplaySummary | null): string {
	const key = mapKey(summary?.mapFileName);
	return key ? normalizeMapName(key) : '';
}

/** Game date when the header has one, else the file time. */
export function replayTime(entry: ReplayEntry): number {
	const parsed = entry.summary?.gameDate ? Date.parse(entry.summary.gameDate) : NaN;
	return Number.isNaN(parsed) ? entry.modified : parsed;
}

export class ReplayLibrary {
	playbackDir = $state<string | null>(null);
	entries = $state.raw<ReplayEntry[]>([]);
	scanning = $state(false);
	ready = $state(false);
	/** True once the first scan listed the playback folder (summaries may still be parsing). */
	listed = $state(false);

	query = $state('');
	faction = $state<FactionKey | 'all'>('all');
	map = $state('all');
	period = $state<ReplayPeriod>('all');
	sort = $state<ReplaySort>('newest');
	/** List page, kept here so going back from a replay returns to the same page. */
	page = $state(1);

	#settings: Store | null = null;
	#cache: Store | null = null;
	#unwatch: (() => void) | null = null;
	#rescan = false;

	maps = $derived.by(() => {
		const labels = new Map<string, string>();
		for (const entry of this.entries) {
			const key = mapKey(entry.summary?.mapFileName);
			if (key && !labels.has(key)) {
				labels.set(key, replayMapLabel(entry.summary));
			}
		}

		return [...labels]
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	filtered = $derived.by(() => {
		const query = this.query.trim().toLowerCase();
		const since =
			this.period === 'all' ? null : Date.now() - PERIOD_DAYS[this.period] * 24 * 60 * 60 * 1000;
		const list = this.entries.filter((entry) => {
			const summary = entry.summary;
			if (
				this.faction !== 'all' &&
				!summary?.players.some((player) => player.faction === this.faction)
			) {
				return false;
			}

			if (this.map !== 'all' && mapKey(summary?.mapFileName) !== this.map) {
				return false;
			}

			if (since !== null && replayTime(entry) < since) {
				return false;
			}

			if (!query) {
				return true;
			}

			const haystack = [
				entry.fileName,
				summary?.replayName,
				replayMapLabel(summary),
				...(summary?.players.map((player) => player.name) ?? [])
			];
			return haystack.some((value) => value?.toLowerCase().includes(query));
		});

		return list.sort((a, b) => {
			switch (this.sort) {
				case 'oldest':
					return replayTime(a) - replayTime(b);
				case 'longest':
					return (b.summary?.durationSeconds ?? 0) - (a.summary?.durationSeconds ?? 0);
				case 'name':
					return replayTitle(a).localeCompare(replayTitle(b));
				default:
					return replayTime(b) - replayTime(a);
			}
		});
	});

	async init() {
		this.#settings = await load('settings.json', { autoSave: true, defaults: {} });
		this.#cache = await load('replay-cache.json', { autoSave: 1000, defaults: {} });
		const detected = await invoke<CohPaths>('detect_coh_paths');
		this.playbackDir = (await this.#settings.get<string>('playbackDir')) || detected.playbackDir;
		this.ready = true;
		await this.#watch();
		await this.scan();
	}

	destroy() {
		this.#unwatch?.();
		this.#unwatch = null;
	}

	async setPlaybackDir(dir: string) {
		this.playbackDir = dir;
		this.entries = [];
		await this.#settings?.set('playbackDir', dir);
		await this.#watch();
		await this.scan();
	}

	/** Lists `.rec` files and parses the ones that changed since the last scan. */
	async scan() {
		const dir = this.playbackDir;
		if (!dir) {
			this.listed = true;
			return;
		}

		if (this.scanning) {
			this.#rescan = true;
			return;
		}

		this.scanning = true;
		try {
			if (!(await exists(dir))) {
				this.entries = [];
				this.listed = true;
				return;
			}

			const files = (await readDir(dir)).filter(
				(file) => file.isFile && file.name.toLowerCase().endsWith('.rec')
			);
			const known = new Map(this.entries.map((entry) => [entry.path, entry]));
			const next: ReplayEntry[] = [];
			const toParse: ReplayEntry[] = [];
			for (const file of files) {
				const path = await join(dir, file.name);
				const info = await stat(path);
				const modified = info.mtime?.getTime() ?? 0;
				const previous = known.get(path);
				const cached = previous?.summary
					? { size: previous.size, modified: previous.modified, summary: previous.summary }
					: await this.#cache?.get<CacheEntry>(path);
				const fresh = cached && cached.size === info.size && cached.modified === modified;
				const entry: ReplayEntry = {
					fileName: file.name,
					path,
					size: info.size,
					modified,
					summary: fresh ? cached.summary : null
				};
				next.push(entry);
				if (!fresh) {
					toParse.push(entry);
				}
			}

			this.entries = next;
			this.listed = true;
			for (const entry of toParse) {
				await this.#summarize(entry);
			}
		} catch (error) {
			console.error('[replay-library] scan failed', error);
			toast.error(t('Could not read the playback folder.'));
		} finally {
			this.scanning = false;
			this.listed = true;
			if (this.#rescan) {
				this.#rescan = false;
				void this.scan();
			}
		}
	}

	find(path: string): ReplayEntry | null {
		return this.entries.find((entry) => entry.path === path) ?? null;
	}

	async readBytes(entry: ReplayEntry): Promise<Uint8Array> {
		return readFile(entry.path);
	}

	/** Changes the in-game replay name and the file name to match; resolves the new path. */
	async rename(entry: ReplayEntry, name: string): Promise<string> {
		const trimmed = name.trim();
		if (!trimmed || INVALID_FILE_NAME.test(trimmed)) {
			throw new Error(t('Use a name without \\ / : * ? " < > |'));
		}

		const dir = this.playbackDir;
		if (!dir) {
			return entry.path;
		}

		const target = await join(dir, `${trimmed}.rec`);
		const sameFile = target.toLowerCase() === entry.path.toLowerCase();
		if (!sameFile && (await exists(target))) {
			throw new Error(t('A replay with this name already exists.'));
		}

		const bytes = setReplayName(await readFile(entry.path), trimmed);
		await writeFile(entry.path, bytes);
		if (target !== entry.path) {
			await rename(entry.path, target);
		}

		await this.scan();
		return target;
	}

	async remove(entry: ReplayEntry) {
		await remove(entry.path);
		await this.#cache?.delete(entry.path);
		this.entries = this.entries.filter((item) => item.path !== entry.path);
	}

	async #summarize(entry: ReplayEntry) {
		let summary: ReplaySummary | null = null;
		let error: string | undefined;
		try {
			summary = await summarizeReplayAsync(await readFile(entry.path));
			await this.#cache?.set(entry.path, {
				size: entry.size,
				modified: entry.modified,
				summary
			} satisfies CacheEntry);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}

		this.entries = this.entries.map((item) =>
			item.path === entry.path ? { ...item, summary, error } : item
		);
	}

	async #watch() {
		this.#unwatch?.();
		this.#unwatch = null;
		const dir = this.playbackDir;
		if (!dir || !(await exists(dir))) {
			return;
		}

		this.#unwatch = await watch(dir, () => void this.scan(), { delayMs: 750 });
	}
}

const context = new Context<ReplayLibrary>('<replay-library />');
export const createReplayLibrary = (library: ReplayLibrary) => context.set(library);
export const useReplayLibrary = () => context.get();
