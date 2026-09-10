import { dev } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';
import { basename, dirname, documentDir, homeDir, join, appConfigDir } from '@tauri-apps/api/path';
import { exists, readTextFile } from '@tauri-apps/plugin-fs';
import { t } from '$lib/i18n';

/**
 * Path resolution and validation for everything the app reads/writes on disk.
 *
 * The Company of Heroes paths are mandatory user configuration; the validators
 * here are the single source of truth used by the boot gate, the onboarding
 * wizard and the settings page.
 */

export const SETTINGS_FILE = dev ? 'settings.dev.json' : 'settings.json';
export const LEGACY_STORE_FILE = dev ? 'app.dev.json' : 'app.json';
export const LEGACY_BACKUP_FILE = 'com.fknoobscoh.app.backup';
export const BACKUP_DIR_NAME = dev ? 'backups-dev' : 'backups';
export const BACKUP_ROOT_NAME = 'FKnoobs CoH';

export type PathValidation = { valid: boolean; reason?: string };

/** Validates a Company of Heroes `warnings.log` path. */
export async function validateWarningsLog(path: string): Promise<PathValidation> {
	if (!path || path.trim() === '') {
		return { valid: false, reason: t('No warnings.log selected') };
	}

	if (!(await exists(path))) {
		return { valid: false, reason: t('File does not exist') };
	}

	const name = (await basename(path)).toLowerCase();

	if (name !== 'warnings.log') {
		return { valid: false, reason: t('Selected file is not warnings.log') };
	}

	return { valid: true };
}

export const COH_CONFIG_FOLDER = 'Company of Heroes Relaunch';
export const COH_GAME_FOLDER = 'Company of Heroes Relaunch';
export const COH_LEGACY_FOLDER = 'Company of Heroes';
export const WARNINGS_LOG_NAME = 'warnings.log';
export const GAME_EXE_NAME = 'RelicCOH.exe';

/** Validates a Company of Heroes installation directory. */
export async function validateGameDir(path: string): Promise<PathValidation> {
	if (!path || path.trim() === '') {
		return { valid: false, reason: t('No installation folder selected') };
	}

	if (!(await exists(path))) {
		return { valid: false, reason: t('Folder does not exist') };
	}

	if (!(await exists(await join(path, GAME_EXE_NAME)))) {
		return { valid: false, reason: t('RelicCOH.exe not found in this folder') };
	}

	return { valid: true };
}

/** Default warnings.log path under Documents (may not exist yet). */
export async function defaultWarningsLogPath(): Promise<string> {
	return join(await documentDir(), 'My Games', COH_CONFIG_FOLDER, WARNINGS_LOG_NAME);
}

/** Folder that should contain warnings.log. */
export async function defaultWarningsLogDir(): Promise<string> {
	return join(await documentDir(), 'My Games', COH_CONFIG_FOLDER);
}

/** Typical Steam install path, used as a hint when detection fails. */
export async function defaultGameDirPath(): Promise<string> {
	return join(
		'C:',
		'Program Files (x86)',
		'Steam',
		'steamapps',
		'common',
		COH_GAME_FOLDER
	);
}

async function warningsLogCandidates(): Promise<string[]> {
	const docs = await documentDir();
	const folders = [COH_CONFIG_FOLDER, COH_LEGACY_FOLDER];
	const candidates: string[] = [];

	for (const folder of folders) {
		candidates.push(await join(docs, 'My Games', folder, WARNINGS_LOG_NAME));
	}

	try {
		const home = await homeDir();
		for (const folder of folders) {
			candidates.push(
				await join(home, 'OneDrive', 'Documents', 'My Games', folder, WARNINGS_LOG_NAME)
			);
		}
	} catch {
		// homeDir is best effort
	}

	return candidates;
}

function parseLibraryFolders(content: string): string[] {
	const paths: string[] = [];

	for (const match of content.matchAll(/"path"\s+"([^"]+)"/g)) {
		paths.push(match[1].replace(/\\\\/g, '\\'));
	}

	return paths;
}

function enqueueSteamRoot(queue: string[], queued: Set<string>, raw: string) {
	const normalized = raw.replace(/\//g, '\\').replace(/\\+$/, '');
	const key = normalized.toLowerCase();

	if (!normalized || queued.has(key)) {
		return;
	}

	queued.add(key);
	queue.push(normalized);
}

async function collectSteamLibraries(): Promise<string[]> {
	const queue: string[] = [];
	const queued = new Set<string>();

	try {
		const fromRegistry = await invoke<string | null>('get_steam_install_path');

		if (fromRegistry) {
			enqueueSteamRoot(queue, queued, fromRegistry);
		}
	} catch {
		// registry lookup is best effort
	}

	enqueueSteamRoot(queue, queued, 'C:\\Program Files (x86)\\Steam');
	enqueueSteamRoot(queue, queued, 'C:\\Program Files\\Steam');
	enqueueSteamRoot(queue, queued, 'C:\\Steam');
	enqueueSteamRoot(queue, queued, 'C:\\SteamLibrary');

	const libraries: string[] = [];

	for (let i = 0; i < queue.length; i++) {
		const root = queue[i];
		const steamapps = await join(root, 'steamapps');

		if (!(await exists(steamapps))) {
			continue;
		}

		libraries.push(root);

		for (const parts of [
			['steamapps', 'libraryfolders.vdf'],
			['config', 'libraryfolders.vdf']
		]) {
			try {
				const vdfPath = await join(root, ...parts);

				if (!(await exists(vdfPath))) {
					continue;
				}

				for (const libraryPath of parseLibraryFolders(await readTextFile(vdfPath))) {
					enqueueSteamRoot(queue, queued, libraryPath);
				}
			} catch {
				// ignore, detection is best effort
			}
		}
	}

	return libraries;
}

/** Attempts to auto-detect the warnings.log location. */
export async function detectWarningsLog(): Promise<string | null> {
	for (const candidate of await warningsLogCandidates()) {
		if ((await validateWarningsLog(candidate)).valid) {
			return candidate;
		}
	}

	return null;
}

/** Attempts to auto-detect the CoH installation directory (Steam libraries). */
export async function detectGameDir(): Promise<string | null> {
	const folders = [COH_GAME_FOLDER, COH_LEGACY_FOLDER];

	for (const library of await collectSteamLibraries()) {
		for (const folder of folders) {
			const candidate = await join(library, 'steamapps', 'common', folder);

			if ((await validateGameDir(candidate)).valid) {
				return candidate;
			}
		}
	}

	return null;
}

/**
 * Application path resolution. Kept as a class for facade compatibility
 * (`app.paths`), but no longer depends on the app context: the CoH paths
 * are provided through a getter so they always reflect live settings.
 */
export class Paths {
	#getCohPaths: () => { warningsLog: string; gameDir: string };

	constructor(getCohPaths: () => { warningsLog: string; gameDir: string }) {
		this.#getCohPaths = getCohPaths;
	}

	/** Directory containing warnings.log (`.../My Games/Company of Heroes Relaunch`). */
	async cohConfigDir(): Promise<string> {
		const { warningsLog } = this.#getCohPaths();

		if (warningsLog) {
			try {
				return await dirname(warningsLog);
			} catch {
				// fall through to default
			}
		}

		return join(await documentDir(), 'My Games', 'Company of Heroes Relaunch');
	}

	async cohPlaybackDir(): Promise<string> {
		return join(await this.cohConfigDir(), 'playback');
	}

	/**
	 * Documents root that owns the CoH My Games tree (OneDrive-aware via cohConfigDir).
	 */
	async cohDocumentsDir(): Promise<string> {
		const configDir = await this.cohConfigDir();
		const idx = configDir.search(/[/\\]My Games[/\\]Company of Heroes/i);
		if (idx > 0) {
			return configDir.slice(0, idx);
		}

		return this.documentDir();
	}

	async cohInstallationDir(): Promise<string> {
		const { gameDir } = this.#getCohPaths();

		return (
			gameDir ||
			join('C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'Company of Heroes Relaunch')
		);
	}

	async documentDir(): Promise<string> {
		return documentDir();
	}

	async appConfigDir(): Promise<string> {
		return appConfigDir();
	}

	/** The v2 settings file. */
	async settingsFilePath(): Promise<string> {
		return join(await this.appConfigDir(), SETTINGS_FILE);
	}

	/** The legacy plugin-store file (v1), used for migration only. */
	async legacyStoreFilePath(): Promise<string> {
		return join(await this.appConfigDir(), LEGACY_STORE_FILE);
	}

	/** Legacy single-file backup written by old app versions. */
	async legacyBackupFilePath(): Promise<string> {
		return join(await this.documentDir(), LEGACY_BACKUP_FILE);
	}

	/** External backup directory (survives app data deletion). */
	async backupDir(): Promise<string> {
		return join(await this.documentDir(), BACKUP_ROOT_NAME, BACKUP_DIR_NAME);
	}

	/** @deprecated kept for facade compatibility; same as settingsFilePath. */
	async appConfigFilePath(): Promise<string> {
		return this.settingsFilePath();
	}

	/** @deprecated kept for facade compatibility; same as legacyBackupFilePath. */
	async appConfigFileBackupPath(): Promise<string> {
		return this.legacyBackupFilePath();
	}
}
