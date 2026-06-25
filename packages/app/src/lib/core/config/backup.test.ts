import { beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from './backup';
import { Paths } from './paths';
import { defaultSettings, type Settings } from './schema';
import { __fs } from '@tauri-apps/plugin-fs';
import v1Fixture from '../../../tests/fixtures/app.v1.json';

const BACKUP_DIR = 'C:/Users/test/Documents/FKnoobs CoH/backups';
const LEGACY_BACKUP = 'C:/Users/test/Documents/com.fknoobscoh.app.backup';

function makeService(tree: Settings, now?: () => Date) {
	const paths = new Paths(() => ({
		warningsLog: tree.app.companyOfHeroesConfigPath,
		gameDir: tree.app.companyOfHeroesInstallationPath
	}));

	return new BackupService(paths, () => tree, now);
}

describe('BackupService', () => {
	let tree: Settings;

	beforeEach(() => {
		__fs.reset();
		tree = defaultSettings();
		tree.account.userId = 'abc123def456ghi';
		tree.account.email = 'user@fknoobs.com';
		tree.account.password = 'secret';
	});

	it('writes latest + a rotated copy for checkpoint reasons', async () => {
		const service = makeService(tree, () => new Date(2026, 5, 11, 12, 0, 0));

		await service.backupNow('boot');

		expect(__fs.has(`${BACKUP_DIR}/settings-latest.json`)).toBe(true);
		expect(__fs.has(`${BACKUP_DIR}/settings-20260611-120000.json`)).toBe(true);
		expect(service.lastBackupAt).not.toBeNull();
		expect(service.lastError).toBeNull();
	});

	it('only updates latest for change backups', async () => {
		const service = makeService(tree);

		await service.backupNow('change');

		const rotated = __fs.listFiles().filter((f) => f.startsWith(BACKUP_DIR) && !f.endsWith('settings-latest.json'));

		expect(__fs.has(`${BACKUP_DIR}/settings-latest.json`)).toBe(true);
		expect(rotated).toHaveLength(0);
	});

	it('prunes rotated backups beyond the retention limit', async () => {
		let tick = 0;
		const service = makeService(tree, () => new Date(2026, 0, 1, 0, 0, tick++));

		for (let i = 0; i < 14; i++) {
			await service.backupNow('manual');
		}

		const rotated = __fs
			.listFiles()
			.filter(
				(f) =>
					f.startsWith(`${BACKUP_DIR}/settings-`) && !f.endsWith('settings-latest.json')
			);

		expect(rotated).toHaveLength(10);
		// The oldest ones are pruned; the newest remain.
		const sorted = rotated.sort();
		expect(sorted[0].endsWith('settings-20260101-000000.json')).toBe(false);
		expect(sorted.at(-1)! > sorted[0]).toBe(true);
	});

	it('finds the latest backup as the best restore candidate', async () => {
		const service = makeService(tree);
		await service.backupNow('boot');

		const candidate = await service.findBestRestoreCandidate();

		expect(candidate).not.toBeNull();
		expect(candidate!.source).toBe('latest');
		expect(candidate!.settings.account.userId).toBe('abc123def456ghi');
	});

	it('skips corrupt backups', async () => {
		__fs.setFile(`${BACKUP_DIR}/settings-latest.json`, '{ corrupt');
		__fs.setFile(`${BACKUP_DIR}/settings-20260101-000000.json`, JSON.stringify(tree));

		const service = makeService(tree);
		const candidates = await service.findRestoreCandidates();

		expect(candidates).toHaveLength(1);
		expect(candidates[0].source).toBe('rotated');
	});

	it('falls back to the legacy v1 backup file and migrates it', async () => {
		__fs.setFile(LEGACY_BACKUP, JSON.stringify(v1Fixture));

		const service = makeService(defaultSettings());
		const candidate = await service.findBestRestoreCandidate();

		expect(candidate).not.toBeNull();
		expect(candidate!.source).toBe('legacy');
		expect(candidate!.settings.account.userId).toBe('abc123def456ghi');
	});

	it('prefers candidates that contain an account', async () => {
		// latest has no account, legacy does
		__fs.setFile(`${BACKUP_DIR}/settings-latest.json`, JSON.stringify(defaultSettings()));
		__fs.setFile(LEGACY_BACKUP, JSON.stringify(v1Fixture));

		const service = makeService(defaultSettings());
		const candidate = await service.findBestRestoreCandidate();

		expect(candidate!.source).toBe('legacy');
		expect(candidate!.settings.account.userId).toBe('abc123def456ghi');
	});

	it('returns null when nothing is restorable', async () => {
		const service = makeService(defaultSettings());

		expect(await service.findBestRestoreCandidate()).toBeNull();
	});
});
