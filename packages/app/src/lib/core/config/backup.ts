import { exists, mkdir, readDir, remove } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { Paths } from './paths';
import type { Settings } from './schema';
import { migrateToCurrent } from './migrations';
import { readJsonWithRecovery, writeJsonAtomic } from './fs-json';

/**
 * External settings backups.
 *
 * Backups live outside the app data directory (in the user's Documents
 * folder), so they survive an app update where the user chooses to delete all
 * application data. They contain the full settings tree, including the
 * PocketBase account credentials — restoring a backup therefore restores the
 * user's account.
 */

export type BackupReason =
	| 'boot'
	| 'change'
	| 'pre-import'
	| 'pre-update'
	| 'account-created'
	| 'manual';

export type BackupCandidate = {
	path: string;
	settings: Settings;
	source: 'latest' | 'rotated' | 'legacy';
};

const LATEST_FILE = 'settings-latest.json';
const ROTATED_PREFIX = 'settings-';
const MAX_ROTATED = 10;
const CHANGE_DEBOUNCE_MS = 30_000;

function timestamp(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return (
		`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
		`-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
	);
}

export class BackupService {
	#paths: Paths;
	#getTree: () => Settings;
	#now: () => Date;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#queue: Promise<void> = Promise.resolve();

	lastBackupAt: Date | null = null;
	lastError: string | null = null;

	constructor(paths: Paths, getTree: () => Settings, now: () => Date = () => new Date()) {
		this.#paths = paths;
		this.#getTree = getTree;
		this.#now = now;
	}

	/** Schedules a debounced backup after a settings change. */
	schedule(): void {
		if (this.#timer) {
			clearTimeout(this.#timer);
		}

		this.#timer = setTimeout(() => {
			this.#timer = null;
			void this.backupNow('change');
		}, CHANGE_DEBOUNCE_MS);
	}

	/** Writes a backup immediately. Never throws; failures are recorded. */
	backupNow(reason: BackupReason): Promise<void> {
		// Serialize backups so rotation never races with itself.
		this.#queue = this.#queue.then(() => this.#write(reason)).catch(() => undefined);
		return this.#queue;
	}

	async flush(): Promise<void> {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
			await this.backupNow('change');
		} else {
			await this.#queue;
		}
	}

	async #write(reason: BackupReason): Promise<void> {
		try {
			const dir = await this.#paths.backupDir();

			if (!(await exists(dir))) {
				await mkdir(dir, { recursive: true });
			}

			const tree = this.#getTree();

			await writeJsonAtomic(await join(dir, LATEST_FILE), tree);

			// Rotated copies are only written for meaningful checkpoints; the
			// debounced change backups keep updating `latest` instead.
			if (reason !== 'change') {
				const name = `${ROTATED_PREFIX}${timestamp(this.#now())}.json`;
				await writeJsonAtomic(await join(dir, name), tree);
				await this.#prune(dir);
			}

			this.lastBackupAt = this.#now();
			this.lastError = null;
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error);
			console.error(`[BACKUP]: Failed to write backup (${reason}):`, error);
		}
	}

	async #prune(dir: string): Promise<void> {
		const entries = await readDir(dir);

		const rotated = entries
			.filter(
				(entry) =>
					entry.isFile &&
					entry.name.startsWith(ROTATED_PREFIX) &&
					entry.name.endsWith('.json') &&
					entry.name !== LATEST_FILE &&
					!entry.name.endsWith('.tmp')
			)
			.map((entry) => entry.name)
			// Timestamped names sort chronologically.
			.sort()
			.reverse();

		for (const name of rotated.slice(MAX_ROTATED)) {
			try {
				await remove(await join(dir, name));
			} catch {
				// pruning is best effort
			}
		}
	}

	/**
	 * Finds restorable settings, newest first:
	 * 1. `settings-latest.json`
	 * 2. rotated backups (newest first)
	 * 3. the legacy single-file backup written by old app versions
	 *
	 * Invalid/corrupt candidates are skipped silently.
	 */
	async findRestoreCandidates(): Promise<BackupCandidate[]> {
		const candidates: BackupCandidate[] = [];
		const dir = await this.#paths.backupDir();

		if (await exists(dir)) {
			const latestPath = await join(dir, LATEST_FILE);
			const latest = await this.#parseCandidate(latestPath, 'latest');

			if (latest) {
				candidates.push(latest);
			}

			try {
				const entries = await readDir(dir);
				const rotated = entries
					.filter(
						(entry) =>
							entry.isFile &&
							entry.name.startsWith(ROTATED_PREFIX) &&
							entry.name !== LATEST_FILE &&
							entry.name.endsWith('.json')
					)
					.map((entry) => entry.name)
					.sort()
					.reverse();

				for (const name of rotated) {
					const candidate = await this.#parseCandidate(await join(dir, name), 'rotated');

					if (candidate) {
						candidates.push(candidate);
					}
				}
			} catch {
				// directory listing is best effort
			}
		}

		const legacyPath = await this.#paths.legacyBackupFilePath();
		const legacy = await this.#parseCandidate(legacyPath, 'legacy');

		if (legacy) {
			candidates.push(legacy);
		}

		return candidates;
	}

	/** The most useful restore candidate (one with an account), if any. */
	async findBestRestoreCandidate(): Promise<BackupCandidate | null> {
		const candidates = await this.findRestoreCandidates();
		return candidates.find((c) => c.settings.account.userId !== '') ?? candidates[0] ?? null;
	}

	async #parseCandidate(
		path: string,
		source: BackupCandidate['source']
	): Promise<BackupCandidate | null> {
		const read = await readJsonWithRecovery(path);

		if (!read.ok) {
			return null;
		}

		const migrated = migrateToCurrent(read.data);

		if (!migrated.success) {
			return null;
		}

		return { path, settings: migrated.data, source };
	}
}
