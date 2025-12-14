// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)

import { browser } from '$app/environment';
import { app } from '$core/app';
import { tts, twitch } from '$features/twitch';
import { ttsPersonalVoices } from '$features/tts-personal-voices';
import { twitchOverlays } from '$features/twitch-overlays';
import { OppBotOverlay } from '$features/twitch-overlays/overlays/oppbot';
import { ChatOverlay } from '$features/twitch-overlays/overlays/chat';
import { twitchBot } from '$features/twitch-bot';
import { auth } from '$features/auth';
import { ViewerCountOverlay } from '$features/twitch-overlays/overlays/viewer-count';
import { updater } from '$features/updater';
import { history } from '$core/app/features/history';
import { replayAnalyzer } from '$features/replay-analyzer';

// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

export const load = async () => {
	if (!browser) {
		return;
	}

	app.register('auth', auth);
	app.register('twitch', twitch);
	app.register('text-to-speech', tts);
	app.register('text-to-speech-custom-characters', ttsPersonalVoices);
	app.register('twitch-overlays', twitchOverlays);
	app.register('twitch-bot', twitchBot);
	app.register('replay-analyzer', replayAnalyzer);
	app.register('history', history);
	app.register('updater', updater);

	twitchOverlays.registerOverlay(new OppBotOverlay());
	twitchOverlays.registerOverlay(new ChatOverlay());
	twitchOverlays.registerOverlay(new ViewerCountOverlay());

	await app.start();
};
