const WS_URL = 'ws://localhost:9842/ws';
const TOPICS = ['game.lobby.started', 'game.lobby.destroyed'] as const;

type MessageHandler = (payload: unknown) => void;

function subscribe(ws: WebSocket, topic: string) {
	ws.send(JSON.stringify({ type: 'subscribe', topic }));
}

export function connectLobby(onMessage: MessageHandler): void {
	let reconnectAttempt = 0;

	const connect = () => {
		const ws = new WebSocket(WS_URL);

		ws.onopen = () => {
			reconnectAttempt = 0;
			for (const topic of TOPICS) {
				subscribe(ws, topic);
			}
		};

		ws.onmessage = (event) => {
			try {
				onMessage(JSON.parse(String(event.data)));
			} catch {
				// Ignore malformed messages.
			}
		};

		ws.onclose = () => {
			const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
			reconnectAttempt += 1;
			setTimeout(connect, delay);
		};
	};

	connect();
}
