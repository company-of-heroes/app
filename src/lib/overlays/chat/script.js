const ws = new WebSocket('ws://localhost:49210');

ws.addEventListener('open', () => {
	ws.send(JSON.stringify({ type: 'subscribe', topic: 'twitch-chat' }));

	ws.addEventListener('message', (event) => {
		console.log(event);
	});
});
