import { dev } from '$app/environment';
import { PUBLIC_PB_URL } from '$env/static/public';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http-original';
import { getUrl, localUrlPattern, selectFetchTransport } from './fetch-routing';

export {
	getUrl,
	isLocalUrl,
	isPocketBaseUrl,
	selectFetchTransport,
	shouldUseNativeFetch
} from './fetch-routing';
export type { FetchTransport } from './fetch-routing';

const pocketBaseOrigin = new URL(PUBLIC_PB_URL ?? 'https://api.coh1stats.com').origin;

type FetchWindow = typeof globalThis & {
	fetchNative?: typeof fetch;
	CORSFetch?: { config: (options: CorsFetchConfig) => void };
};

type CorsFetchConfig = {
	include?: Array<string | RegExp>;
	exclude?: Array<string | RegExp>;
};

function isWorkerContext(): boolean {
	return typeof window === 'undefined' && typeof self !== 'undefined';
}

function warnNativeFetchFallback(url: string): void {
	if (!dev) {
		return;
	}

	console.warn(
		'[app fetch] fetchNative unavailable for PocketBase/localhost URL; falling back to Tauri HTTP:',
		url
	);
}

/** Align cors-fetch with our routing so bare global fetch() matches app fetch(). */
export function configureCorsFetch(): void {
	if (typeof window === 'undefined') {
		return;
	}

	const w = window as FetchWindow;
	const escapedOrigin = pocketBaseOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	w.CORSFetch?.config({
		exclude: [new RegExp(`^${escapedOrigin}`), localUrlPattern]
	});
}

/**
 * HTTP fetch for the Tauri app.
 *
 * - PocketBase + localhost: fetchNative (no Tauri IPC channel streaming)
 * - Other cross-origin APIs: @tauri-apps/plugin-http directly (Relic, Steam, …)
 */
export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url = getUrl(input);
	const w = globalThis as FetchWindow;
	const transport = selectFetchTransport(url, pocketBaseOrigin, {
		hasFetchNative: Boolean(w.fetchNative),
		isWorker: isWorkerContext()
	});

	switch (transport) {
		case 'fetchNative':
			return w.fetchNative!(input, init);
		case 'workerFetch':
			return globalThis.fetch(input, init);
		default:
			warnNativeFetchFallback(url);
			return tauriFetch(input, init);
	}
}
