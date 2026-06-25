import { dev } from '$app/environment';
import { basename, dirname, documentDir, join, appConfigDir } from '@tauri-apps/api/path';
import { exists, readTextFile } from '@tauri-apps/plugin-fs';

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
		return { valid: false, reason: 'No warnings.log selected' };
	}

	if (!(await exists(path))) {
		return { valid: false, reason: 'File does not exist' };
	}

	const name = (await basename(path)).toLowerCase();

	if (name !== 'warnings.log') {
		return { valid: false, reason: 'Selected file is not warnings.log' };
	}

	return { valid: true };
}

/** Validates a Company of Heroes installation directory. */
export async function validateGameDir(path: string): Promise<PathValidation> {
	if (!path || path.trim() === '') {
		return { valid: false, reason: 'No installation folder selected' };
	}

	if (!(await exists(path))) {
		return { valid: false, reason: 'Folder does not exist' };
	}

	if (!(await exists(await join(path, 'RelicCOH.exe')))) {
		return { valid: false, reason: 'RelicCOH.exe not found in this folder' };
	}

	return { valid: true };
}

/** Attempts to auto-detect the warnings.log location. */
export async function detectWarningsLog(): Promise<string | null> {
	const candidate = await join(
		await documentDir(),
		'My Games',
		'Company of Heroes Relaunch',
		'warnings.log'
	);

	return (await validateWarningsLog(candidate)).valid ? candidate : null;
}

/** Attempts to auto-detect the CoH installation directory (Steam libraries). */
export async function detectGameDir(): Promise<string | null> {
	const steamRoots = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];
	const libraries: string[] = [];

	for (const root of steamRoots) {
		libraries.push(root);

		// Best effort: scan additional Steam library folders.
		try {
			const vdfPath = await join(root, 'steamapps', 'libraryfolders.vdf');

			if (await exists(vdfPath)) {
				const content = await readTextFile(vdfPath);

				for (const match of content.matchAll(/"path"\s+"([^"]+)"/g)) {
					libraries.push(match[1].replace(/\\\\/g, '\\'));
				}
			}
		} catch {
			// ignore, detection is best effort
		}
	}

	for (const library of libraries) {
		const candidate = await join(library, 'steamapps', 'common', 'Company of Heroes Relaunch');

		if ((await validateGameDir(candidate)).valid) {
			return candidate;
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
