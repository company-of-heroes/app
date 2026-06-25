import { beforeEach, describe, expect, it } from 'vitest';
import {
	Paths,
	detectGameDir,
	detectWarningsLog,
	validateGameDir,
	validateWarningsLog
} from './paths';
import { __fs } from '@tauri-apps/plugin-fs';

const WARNINGS = 'C:/Users/test/Documents/My Games/Company of Heroes Relaunch/warnings.log';
const GAME_DIR = 'C:/Program Files (x86)/Steam/steamapps/common/Company of Heroes Relaunch';

describe('config/paths', () => {
	beforeEach(() => {
		__fs.reset();
	});

	describe('validateWarningsLog', () => {
		it('accepts an existing warnings.log', async () => {
			__fs.setFile(WARNINGS, 'RELICCOH started');

			expect((await validateWarningsLog(WARNINGS)).valid).toBe(true);
		});

		it('rejects empty paths', async () => {
			expect((await validateWarningsLog('')).valid).toBe(false);
		});

		it('rejects missing files', async () => {
			expect((await validateWarningsLog(WARNINGS)).valid).toBe(false);
		});

		it('rejects files that are not warnings.log', async () => {
			const other = 'C:/logs/other.log';
			__fs.setFile(other, 'data');

			const result = await validateWarningsLog(other);

			expect(result.valid).toBe(false);
			expect(result.reason).toContain('not warnings.log');
		});
	});

	describe('validateGameDir', () => {
		it('accepts a directory containing RelicCOH.exe', async () => {
			__fs.setFile(`${GAME_DIR}/RelicCOH.exe`, 'binary');

			expect((await validateGameDir(GAME_DIR)).valid).toBe(true);
		});

		it('rejects empty and missing directories', async () => {
			expect((await validateGameDir('')).valid).toBe(false);
			expect((await validateGameDir(GAME_DIR)).valid).toBe(false);
		});

		it('rejects directories without RelicCOH.exe', async () => {
			__fs.setDir(GAME_DIR);

			const result = await validateGameDir(GAME_DIR);

			expect(result.valid).toBe(false);
			expect(result.reason).toContain('RelicCOH.exe');
		});
	});

	describe('auto-detection', () => {
		it('detects warnings.log in the default location', async () => {
			__fs.setFile(WARNINGS, 'log');

			expect(await detectWarningsLog()).toBe(WARNINGS);
		});

		it('returns null when warnings.log is absent', async () => {
			expect(await detectWarningsLog()).toBeNull();
		});

		it('detects the game dir in the default Steam library', async () => {
			__fs.setFile(`${GAME_DIR}/RelicCOH.exe`, 'binary');

			expect(await detectGameDir()).toBe(GAME_DIR);
		});

		it('detects the game dir in an alternate Steam library via libraryfolders.vdf', async () => {
			__fs.setFile(
				'C:/Program Files (x86)/Steam/steamapps/libraryfolders.vdf',
				'"libraryfolders"\n{\n\t"1"\n\t{\n\t\t"path"\t\t"D:/SteamLibrary"\n\t}\n}'
			);
			__fs.setFile(
				'D:/SteamLibrary/steamapps/common/Company of Heroes Relaunch/RelicCOH.exe',
				'binary'
			);

			expect(await detectGameDir()).toBe(
				'D:/SteamLibrary/steamapps/common/Company of Heroes Relaunch'
			);
		});

		it('returns null when no installation is found', async () => {
			expect(await detectGameDir()).toBeNull();
		});
	});

	describe('Paths', () => {
		const paths = new Paths(() => ({ warningsLog: WARNINGS, gameDir: GAME_DIR }));

		it('derives the CoH config dir from the warnings.log path', async () => {
			expect(await paths.cohConfigDir()).toBe(
				'C:/Users/test/Documents/My Games/Company of Heroes Relaunch'
			);
		});

		it('derives the playback dir', async () => {
			expect(await paths.cohPlaybackDir()).toBe(
				'C:/Users/test/Documents/My Games/Company of Heroes Relaunch/playback'
			);
		});

		it('falls back to defaults when settings are empty', async () => {
			const empty = new Paths(() => ({ warningsLog: '', gameDir: '' }));

			expect(await empty.cohConfigDir()).toBe(
				'C:/Users/test/Documents/My Games/Company of Heroes Relaunch'
			);
			expect(await empty.cohInstallationDir()).toContain('Company of Heroes Relaunch');
		});

		it('places backups outside the app config dir', async () => {
			const backupDir = await paths.backupDir();

			expect(backupDir).toBe('C:/Users/test/Documents/FKnoobs CoH/backups');
			expect(backupDir).not.toContain('AppData');
		});
	});
});
