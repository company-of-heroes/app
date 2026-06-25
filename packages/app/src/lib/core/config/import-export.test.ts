import { describe, expect, it } from 'vitest';
import {
	createEnvelope,
	createFeatureEnvelope,
	parseFeatureImportContent,
	parseImportContent,
	serializeEnvelope
} from './import-export';
import { defaultSettings } from './schema';
import v1Fixture from '../../../tests/fixtures/app.v1.json';

describe('import-export', () => {
	it('round-trips a full settings envelope', () => {
		const tree = defaultSettings();
		tree.account.userId = 'abc123def456ghi';
		tree.app.companyOfHeroesConfigPath = 'C:/warnings.log';

		const serialized = serializeEnvelope(createEnvelope(tree, '0.50.0'));
		const parsed = parseImportContent(serialized);

		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.account.userId).toBe('abc123def456ghi');
			expect(parsed.data.app.companyOfHeroesConfigPath).toBe('C:/warnings.log');
		}
	});

	it('accepts a raw v2 tree', () => {
		const parsed = parseImportContent(JSON.stringify(defaultSettings()));

		expect(parsed.success).toBe(true);
	});

	it('accepts and migrates a legacy v1 store file', () => {
		const parsed = parseImportContent(JSON.stringify(v1Fixture));

		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.account.userId).toBe('abc123def456ghi');
			expect(parsed.data.features.history).toEqual({ enabled: true });
		}
	});

	it('rejects invalid JSON', () => {
		const parsed = parseImportContent('{ nope');

		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error).toContain('not valid JSON');
		}
	});

	it('rejects non-settings JSON', () => {
		expect(parseImportContent('"hello"').success).toBe(false);
		expect(parseImportContent('[1,2]').success).toBe(false);
	});

	it('rejects a feature envelope on full import', () => {
		const envelope = serializeEnvelope(createFeatureEnvelope('twitch', { enabled: true }, '0.50.0'));
		const parsed = parseImportContent(envelope);

		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error).toContain('feature:twitch');
		}
	});

	describe('feature import', () => {
		it('round-trips a feature envelope', () => {
			const envelope = serializeEnvelope(
				createFeatureEnvelope('twitch', { enabled: true, accessToken: 'tok' }, '0.50.0')
			);
			const parsed = parseFeatureImportContent(envelope, 'twitch');

			expect(parsed.success).toBe(true);
			if (parsed.success) {
				expect(parsed.data).toEqual({ enabled: true, accessToken: 'tok' });
			}
		});

		it('rejects an envelope for another feature', () => {
			const envelope = serializeEnvelope(
				createFeatureEnvelope('twitch', { enabled: true }, '0.50.0')
			);

			expect(parseFeatureImportContent(envelope, 'shortcuts').success).toBe(false);
		});

		it('accepts legacy raw slices', () => {
			const parsed = parseFeatureImportContent(JSON.stringify({ enabled: false, foo: 1 }), 'any');

			expect(parsed.success).toBe(true);
			if (parsed.success) {
				expect(parsed.data).toEqual({ enabled: false, foo: 1 });
			}
		});

		it('rejects arrays and primitives', () => {
			expect(parseFeatureImportContent('[1]', 'x').success).toBe(false);
			expect(parseFeatureImportContent('42', 'x').success).toBe(false);
		});
	});
});
