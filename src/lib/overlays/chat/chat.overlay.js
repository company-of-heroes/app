const ws = new WebSocket('ws://localhost:49210');

ws.addEventListener('open', () => {
	const app = document.getElementById('app');
	ws.send(JSON.stringify({ type: 'subscribe', topic: 'twitch.chat' }));

	ws.addEventListener('message', (event) => {
		const { data, type } = JSON.parse(event.data);

		if (type === 'message') {
			const message = `<div class="message">
				<span class="username">
					${data.data.user}
				</span>
				<span class="text">${data.data.text}</span>
			</div>`;
			app.insertAdjacentHTML('beforeend', message);
		}
	});
});
