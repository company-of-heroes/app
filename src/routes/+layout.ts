// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)

import { browser } from '$app/environment';
import { app } from '$core/app';
import { tts, twitch, elevenlabs } from '$core/app/twitch';
import { ttsPersonalVoices } from '$core/app/twitch/tts-personal-voices.svelte';

// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

export const load = async () => {
	if (!browser) {
		return;
	}

	app.register('twitch', twitch);
	app.register('text-to-speech', tts);
	app.register('text-to-speech-custom-characters', ttsPersonalVoices);

	await app.start();
};
