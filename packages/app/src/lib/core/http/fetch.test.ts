import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __http } from '@tauri-apps/plugin-http-original';
import { fetch } from './fetch';

type FetchWindow = typeof globalThis & {
	fetchNative?: typeof fetch;
};

describe('http/fetch', () => {
	beforeEach(() => {
		__http.reset();
		delete (globalThis as FetchWindow).fetchNative;
	});

	it('routes PocketBase requests through fetchNative', async () => {
		const native = vi.fn(async () => new Response('pb'));
		(globalThis as FetchWindow).fetchNative = native;

		const response = await fetch('http://localhost:8090/api/collections/users/records');

		expect(native).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('pb');
	});

	it('routes external APIs through Tauri HTTP', async () => {
		const tauri = vi.fn(async () => new Response('tauri'));
		__http.setHandler(tauri);

		const response = await fetch('https://reliclink.com/api');

		expect(tauri).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('tauri');
	});
});
