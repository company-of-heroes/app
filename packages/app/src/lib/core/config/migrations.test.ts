import { describe, expect, it } from 'vitest';
import { isV1Store, isV2Tree, migrateToCurrent, migrateV1 } from './migrations';
import { SCHEMA_VERSION, defaultSettings } from './schema';
import v1Fixture from '../../../tests/fixtures/app.v1.json';

describe('migrations', () => {
	describe('isV1Store', () => {
		it('detects the legacy plugin-store shape', () => {
			expect(isV1Store(v1Fixture)).toBe(true);
			expect(isV1Store({ 'feature.twitch': {} })).toBe(true);
		});

		it('rejects v2 trees and non-objects', () => {
			expect(isV1Store(defaultSettings())).toBe(false);
			expect(isV1Store(null)).toBe(false);
			expect(isV1Store([])).toBe(false);
			expect(isV1Store('settings')).toBe(false);
		});
	});

	describe('migrateV1', () => {
		const migrated = migrateV1(v1Fixture as Record<string, unknown>);

		it('produces a valid v2 tree', () => {
			expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
			expect(isV2Tree(migrated)).toBe(true);
		});

		it('maps the app settings slice', () => {
			expect(migrated.app.autostart).toBe(true);
			expect(migrated.app.companyOfHeroesConfigPath).toContain('warnings.log');
			expect(migrated.app.companyOfHeroesInstallationPath).toContain(
				'Company of Heroes Relaunch'
			);
		});

		it('maps feature.auth to the account slice', () => {
			expect(migrated.account.userId).toBe('abc123def456ghi');
			expect(migrated.account.email).toBe(
				'11111111-2222-3333-4444-555555555555@fknoobs.com'
			);
			expect(migrated.account.password).toBe('S3cretPassw0rd16');
			expect(migrated.features.auth).toBeUndefined();
		});

		it('renames legacy feature keys to canonical ids', () => {
			expect(migrated.features.history).toEqual({ enabled: true });
			expect(migrated.features['twitch-overlays']).toEqual({ enabled: true });
			expect(migrated.features.History).toBeUndefined();
			expect(migrated.features.overlays).toBeUndefined();
		});

		it('drops the removed chat feature', () => {
			expect(migrated.features.chat).toBeUndefined();
		});

		it('preserves feature specific keys', () => {
			expect(migrated.features['replay-analyzer']).toMatchObject({
				enabled: true,
				didDoInitialScan: true,
				ignoredFiles: ['temp.rec']
			});
			expect(migrated.features.updater).toMatchObject({ version: '0.44.1' });
		});
	});

	describe('migrateToCurrent', () => {
		it('passes through v2 trees and preserves unknown keys', () => {
			const tree = {
				...defaultSettings(),
				app: { ...defaultSettings().app, futureKey: 'kept' },
				somethingNew: { future: true }
			};

			const result = migrateToCurrent(tree);

			expect(result.success).toBe(true);
			if (result.success) {
				expect((result.data.app as Record<string, unknown>).futureKey).toBe('kept');
				expect((result.data as Record<string, unknown>).somethingNew).toEqual({ future: true });
			}
		});

		it('migrates v1 stores', () => {
			const result = migrateToCurrent(v1Fixture);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.account.userId).toBe('abc123def456ghi');
			}
		});

		it('rejects garbage', () => {
			expect(migrateToCurrent('not-an-object').success).toBe(false);
			expect(migrateToCurrent(null).success).toBe(false);
			expect(migrateToCurrent(42).success).toBe(false);
			expect(migrateToCurrent([1, 2, 3]).success).toBe(false);
		});
	});
});
