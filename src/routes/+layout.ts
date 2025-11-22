// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)

import { browser } from '$app/environment';
import { app } from '$core/app';
import { tts, twitch } from '$plugins/twitch';
import { ttsPersonalVoices } from '$plugins/tts-personal-voices';
import { twitchOverlays } from '$plugins/twitch-overlays';
import { OppBotOverlay } from '$plugins/twitch-overlays/overlays/oppbot';
import { ChatOverlay } from '$plugins/twitch-overlays/overlays/chat';
import { twitchBot } from '$plugins/twitch-bot';
import { ViewerCountOverlay } from '$plugins/twitch-overlays/overlays/viewer-count';
import { updater } from '$plugins/updater';

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
	app.register('twitch-overlays', twitchOverlays);
	app.register('twitch-bot', twitchBot);
	app.register('updater', updater);

	twitchOverlays.registerOverlay(new OppBotOverlay());
	twitchOverlays.registerOverlay(new ChatOverlay());
	twitchOverlays.registerOverlay(new ViewerCountOverlay());

	await app.start();
};
