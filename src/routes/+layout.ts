// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)

import { Window } from '@tauri-apps/api/window';
import { auth } from '$core/app/features/auth';
import { tts, twitch } from '$core/app/features/twitch';
import { ttsPersonalVoices } from '$core/app/features/tts-personal-voices';
import { twitchOverlays } from '$core/app/features/twitch-overlays';
import { twitchBot } from '$core/app/features/twitch-bot';
import { replayAnalyzer } from '$core/app/features/replay-analyzer';
import { history } from '$core/app/features/history';
import { shortcuts } from '$core/app/features/shortcuts';
import { chat } from '$core/app/features/chat';
import { updater } from '$core/app/features/updater';
import { app } from '$core/context';
import { OppBotOverlay } from '$core/app/features/twitch-overlays/overlays/oppbot';
import { ChatOverlay } from '$core/app/features/twitch-overlays/overlays/chat';
import { ViewerCountOverlay } from '$core/app/features/twitch-overlays/overlays/viewer-count';

// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

export const load = async () => {
	app.register('auth', auth);
	app.register('twitch', twitch);
	app.register('text-to-speech', tts);
	app.register('text-to-speech-custom-characters', ttsPersonalVoices);
	app.register('twitch-overlays', twitchOverlays);
	app.register('twitch-bot', twitchBot);
	app.register('replay-analyzer', replayAnalyzer);
	app.register('history', history);
	app.register('shortcuts', shortcuts);
	app.register('chat', chat);
	app.register('updater', updater);

	twitchOverlays.registerOverlay(new OppBotOverlay());
	twitchOverlays.registerOverlay(new ChatOverlay());
	twitchOverlays.registerOverlay(new ViewerCountOverlay());

	return {
		app: await app.start()
	};

	// if (currentWindow.label === 'main') {

	// 	if (dev) {
	// 		await app.start();
	// 	} else {
	// 		app
	// 			.start()
	// 			.then(() => {
	// 				!isReady && goto('/');
	// 			})
	// 			.then(() => (isReady = true));
	// 	}
	// }
};
