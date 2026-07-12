import { describe, expect, it } from 'vitest';
import {
	getUrl,
	isLocalUrl,
	isPocketBaseUrl,
	localUrlPattern,
	selectFetchTransport,
	shouldUseNativeFetch
} from './fetch-routing';

const pbOrigin = 'https://api.coh1stats.com';

describe('http/fetch-routing', () => {
	describe('getUrl', () => {
		it('reads string inputs', () => {
			expect(getUrl('https://example.com/path')).toBe('https://example.com/path');
		});

		it('reads URL objects', () => {
			expect(getUrl(new URL('https://example.com/path'))).toBe('https://example.com/path');
		});

		it('reads Request objects', () => {
			expect(getUrl(new Request('https://example.com/path'))).toBe('https://example.com/path');
		});
	});

	describe('isPocketBaseUrl', () => {
		it('matches the configured PocketBase origin', () => {
			expect(isPocketBaseUrl('https://api.coh1stats.com/api/collections/users', pbOrigin)).toBe(
				true
			);
		});

		it('rejects other origins', () => {
			expect(isPocketBaseUrl('https://api.steamelements.com/voices', pbOrigin)).toBe(false);
		});

		it('rejects invalid URLs', () => {
			expect(isPocketBaseUrl('not-a-url', pbOrigin)).toBe(false);
		});
	});

	describe('isLocalUrl', () => {
		it.each([
			'http://localhost:8090/api/health',
			'http://127.0.0.1:9000/health',
			'http://[::1]:8090/api/health'
		])('matches %s', (url) => {
			expect(isLocalUrl(url)).toBe(true);
		});

		it('rejects remote URLs', () => {
			expect(isLocalUrl('https://api.coh1stats.com/api/health')).toBe(false);
		});
	});

	describe('shouldUseNativeFetch', () => {
		it('is true for PocketBase and localhost URLs', () => {
			expect(shouldUseNativeFetch('https://api.coh1stats.com/api/test', pbOrigin)).toBe(true);
			expect(shouldUseNativeFetch('http://localhost:8090/api/test', pbOrigin)).toBe(true);
		});

		it('is false for external APIs', () => {
			expect(shouldUseNativeFetch('https://reliclink.com/api', pbOrigin)).toBe(false);
		});
	});

	describe('localUrlPattern', () => {
		it('matches localhost variants used by cors-fetch excludes', () => {
			expect(localUrlPattern.test('http://localhost:1420/')).toBe(true);
			expect(localUrlPattern.test('http://127.0.0.1:9000/health')).toBe(true);
			expect(localUrlPattern.test('http://[::1]:8090/api/health')).toBe(true);
		});
	});

	describe('selectFetchTransport', () => {
		it('prefers fetchNative, then workerFetch, then tauri for native targets', () => {
			expect(
				selectFetchTransport('http://localhost:8090/api/test', pbOrigin, {
					hasFetchNative: true,
					isWorker: true
				})
			).toBe('fetchNative');
			expect(
				selectFetchTransport('http://localhost:8090/api/test', pbOrigin, {
					hasFetchNative: false,
					isWorker: true
				})
			).toBe('workerFetch');
			expect(
				selectFetchTransport('http://localhost:8090/api/test', pbOrigin, {
					hasFetchNative: false,
					isWorker: false
				})
			).toBe('tauri');
		});
	});
});
