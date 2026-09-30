import { fetch as tauriFetch } from '@tauri-apps/plugin-http-original';
import { getUrl, localUrlPattern, shouldUseNativeFetch } from './fetch-routing';

export { getUrl, isLocalUrl, isPocketBaseUrl, shouldUseNativeFetch } from './fetch-routing';

const pocketBaseOrigin = new URL(
	(import.meta.env.PUBLIC_PB_URL as string | undefined) ?? 'https://api.coh1stats.com'
).origin;

type FetchWindow = typeof globalThis & {
	fetchNative?: typeof fetch;
	CORSFetch?: { config: (options: CorsFetchConfig) => void };
};

type CorsFetchConfig = {
	include?: Array<string | RegExp>;
	exclude?: Array<string | RegExp>;
};

type AppFetchInit = RequestInit & {
	danger?: {
		acceptInvalidCerts?: boolean;
		acceptInvalidHostnames?: boolean;
	};
};

/**
 * The browser's own fetch. cors-fetch moves it to `fetchNative` in the main window;
 * workers and tests never get patched, so there the global fetch already is the native one.
 */
function browserFetch(): typeof globalThis.fetch {
	const w = globalThis as FetchWindow;
	return w.fetchNative ?? globalThis.fetch;
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
 * HTTP fetch for the Tauri app. Two fixed routes, no fallbacks:
 *
 * - PocketBase + localhost: the browser's fetch (CORS-enabled, streams, no IPC)
 * - Everything else (Relic, Steam, Twitch, …): @tauri-apps/plugin-http
 */
export function fetch(input: RequestInfo | URL, init?: AppFetchInit): Promise<Response> {
	if (shouldUseNativeFetch(getUrl(input), pocketBaseOrigin)) {
		return browserFetch()(input, init);
	}

	return tauriFetch(input, init);
}
