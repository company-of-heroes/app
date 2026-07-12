// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info

import type { LoadEvent } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { configureCorsFetch } from '$core/http/fetch';
import { app } from '$core/app/context';
import { boot } from '$core/runtime/boot.svelte';
import { tts, twitch } from '$core/app/features/twitch';
import { ttsPersonalVoices } from '$core/app/features/tts-personal-voices';
import { twitchOverlays } from '$core/app/features/twitch-overlays';
import { twitchBot } from '$core/app/features/twitch-bot';
import { replayAnalyzer } from '$core/app/features/replay-analyzer';
import { history } from '$core/app/features/history';
import { shortcuts } from '$core/app/features/shortcuts';
import { updater } from '$core/app/features/updater';
import { OppBotOverlay } from '$core/app/features/twitch-overlays/overlays/oppbot';

export const prerender = true;
export const ssr = false;

let registered = false;

/** Routes that render boot progress UI — must not block on boot.advance(). */
const BOOT_UI_ROUTES = new Set(['/splashscreen', '/setup']);

export const load = async ({ url }: LoadEvent) => {
	if (!browser) {
		return;
	}

	configureCorsFetch();

	if (!registered) {
		registered = true;

		app.register('updater', updater);
		app.register('shortcuts', shortcuts);
		app.register('history', history);
		app.register('replay-analyzer', replayAnalyzer);
		app.register('twitch', twitch);
		app.register('text-to-speech', tts);
		app.register('text-to-speech-custom-characters', ttsPersonalVoices);
		app.register('twitch-bot', twitchBot);
		app.register('twitch-overlays', twitchOverlays);

		twitchOverlays.registerOverlay(new OppBotOverlay());
	}

	// Boot can take several seconds. On splash/setup, render the UI immediately
	// and let boot.advance() update phase labels reactively in the background.
	if (BOOT_UI_ROUTES.has(url.pathname)) {
		void boot.advance(url.pathname);
		return;
	}

	await boot.advance(url.pathname);
};
