import { CoH } from './src/coh/coh';
import { relic } from './src/relic';

const coh = new CoH(
	'C:\\Users\\Richa\\OneDrive\\Documenten\\My Games\\Company of Heroes Relaunch\\warnings.log'
);

coh.start();

coh.game.on('LOBBY:STARTED', (lobby) => {
	console.log('Lobby started:', lobby.getPlayers());
});

//import './parser.js';

// import { lobby, config, coh } from './src/parser';

//coh.on('LOG:ENDED', () => console.log('Game closed'));

// config.pathToWarnings = '/home/codeit/fknoobscoh/bun-sidecar/warnings.log';

// coh.on('LOG:LOBBY:STARTED', (lobby) => {
// 	console.log(lobby);
// });
// lobby.on('LOBBY:GAMEOVER', () => console.log('Lobby ended'));
// lobby.on('LOBBY:POPULATED:STEAM', (steamId) => {
// 	console.log('LOBBY:POPULATED:STEAM');
// });
// coh.on('GAME:CLOSED', () => console.log('Game closed'));

// const server = Bun.serve({
// 	port: 55123,
// 	fetch(req, server) {
// 		if (server.upgrade(req)) {
// 			return;
// 		}
// 		return new Response('Upgrade failed', { status: 500 });
// 	},
// 	websocket: {
// 		message(ws, message) {
// 			console.log('WebSocket message received:', message);
// 		}, // a message is received
// 		open(ws) {
// 			console.log('WebSocket opened');
// 		}, // a socket is opened
// 		close(ws, code, message) {
// 			console.log('WebSocket closed');
// 		}, // a socket is closed
// 		drain(ws) {
// 			console.log('WebSocket drained');
// 		} // the socket is ready to receive more data
// 	}
// });

// New-Item -ItemType SymbolicLink -Path "C:/Users/Richa/OneDrive/Documenten/My Games/Company of Heroes Relaunch/warnings.log" -Target "/wsl.localhost\Ubuntu-24.04\home\codeit\fknoobscoh\bun-sidecar\warnings.log"
