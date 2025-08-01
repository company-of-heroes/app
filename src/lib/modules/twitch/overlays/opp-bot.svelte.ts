import { Overlay } from './overlay.svelte';

export class OppBotOverlay extends Overlay {
	name = 'Opponent bot';

	path = 'overlays/opponent-bot';

	zipUrl =
		'https://github.com/fknoobs/app/raw/refs/heads/master/src/lib/files/overlays/opp-overlay.zip';

	constructor() {
		super();

		this.on('init', async (app) => {
			app.game.on('LOBBY:STARTED', (lobby) => {
				app.socket.publish('game.lobby.started', lobby);
			});

			app.game.on('LOBBY:DESTROYED', () => {
				setTimeout(() => app.socket.publish('game.lobby.destroyed', null));
			});
		});
	}
}
