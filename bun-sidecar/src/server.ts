import { CoH } from './coh/coh';

export const server = Bun.serve({
	port: 55123,
	fetch(req, server) {
		if (server.upgrade(req)) {
			return;
		}
		return new Response('Upgrade failed', { status: 500 });
	},
	websocket: {
		message(ws, message) {
			const payload = JSON.parse(message as string);

			if (payload.type === 'INIT') {
				new CoH(payload.data).start();
			}
		},
		open(ws) {
			ws.subscribe('game');
		},
		close(ws, code, message) {
			ws.unsubscribe('game');
		}
	}
});
