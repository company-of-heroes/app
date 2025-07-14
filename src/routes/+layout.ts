// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)

import type { GameEvent } from '@fknoobs/app/ws';
import { browser } from '$app/environment';
import { app } from '$lib/state/app.svelte.js';
import { Command } from '@tauri-apps/plugin-shell';
import { Lobby } from '$lib/state/coh.svelte.js';

// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

export const load = async ({ fetch }) => {
	if (!browser) {
		return;
	}

	await app.boot();
	Command.sidecar('binaries/fknoobs').execute();

	const ws = new WebSocket('ws://localhost:55123');

	ws.addEventListener('open', () => {
		ws.send(JSON.stringify({ type: 'INIT', data: app.settings.pathToWarnings }));
	});

	ws.addEventListener('message', async (event) => {
		const data = JSON.parse(event.data) as GameEvent;

		switch (data.type) {
			case 'GAME:LAUNCHED':
				app.game.emit('GAME:LAUNCHED', data.data);

				break;
			case 'LOBBY:STARTED':
				app.game.emit('LOBBY:STARTED', data.data);

				break;
			case 'LOBBY:GAMEOVER':
				app.game.emit('LOBBY:GAMEOVER', data.data);

				break;
			case 'LOBBY:DESTROYED':
				//app.game.emit('LOBBY:DESTROYED');

				break;

			// case 'GAME:CLOSED':
			// 	app.game.isRunning = false;
			// 	app.game.steamId = undefined;
			// 	app.game.profile = undefined;
			// 	app.game.lobby = undefined;
			// 	break;
		}
	});
};
