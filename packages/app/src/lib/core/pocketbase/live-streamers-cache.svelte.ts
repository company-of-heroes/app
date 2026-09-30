import { api } from '$core/api';

const POLL_MS = 60_000;

let live = $state.raw<ReadonlySet<string>>(new Set());
let timer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
	const result = await api.streaming.listLiveSteamIds();
	if (result.isOk()) {
		live = new Set(result.value);
	}
}

/** Reactive; the first read starts polling the live streamers. */
export function isStreamerLive(steamId: string | undefined | null): boolean {
	if (!timer) {
		timer = setInterval(() => void refresh(), POLL_MS);
		void refresh();
	}

	return Boolean(steamId) && live.has(steamId as string);
}
