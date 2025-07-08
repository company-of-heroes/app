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

	ws.addEventListener('message', (event) => {
		const data = JSON.parse(event.data) as GameEvent;

		switch (data.type) {
			case 'GAME:LAUNCHED':
				console.log(data.type);
				app.game.isRunning = data.data.isRunning;
				app.game.steamId = data.data.steamId;
				app.game.profile = data.data.profile;
				console.log(app.game);
				break;
			case 'LOBBY:STARTED':
				app.game.lobby = new Lobby();
				app.game.lobby.isStarted = data.data.isStarted;
				app.game.lobby.map = data.data.map;
				app.game.lobby.outcome = data.data.outcome;
				app.game.lobby.players = data.data.players;

				break;
			case 'LOBBY:ENDED':
				if (!app.game.lobby) {
					console.error('Lobby not initialized');
					return;
				}

				app.game.lobby.isStarted = data.data.isStarted;
				app.game.lobby.map = data.data.map;
				app.game.lobby.outcome = data.data.outcome;
				app.game.lobby.players = data.data.players;

				break;
		}
	});
};
