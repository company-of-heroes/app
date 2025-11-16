//import { data_4v4 } from './scripts/data.js';
import { getConnection } from './scripts/websocket.js';
import './scripts/handlebars.js';

const socket = await getConnection('ws://localhost:9842/ws');
const request = await fetch('./template.hbs');
const html = await request.text();
const template = Handlebars.compile(html);

socket.send(JSON.stringify({ type: 'subscribe', topic: 'game.lobby.started' }));
socket.send(JSON.stringify({ type: 'subscribe', topic: 'game.lobby.destroyed' }));

socket.addEventListener('message', (event) => {
	const { data, type, topic } = JSON.parse(event.data);
	//console.log(JSON.parse(event.data));
	if (type === 'message' && topic === 'game.lobby.started') {
		app.innerHTML = template({ ...data });
	}

	if (type === 'message' && topic === 'game.lobby.destroyed') {
		app.innerHTML = '';
	}
});
