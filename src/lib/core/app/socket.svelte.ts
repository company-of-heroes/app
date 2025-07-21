import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { app } from './app.svelte';
import WebSocket from '@tauri-apps/plugin-websocket';

export type SocketStatus = {
	running: boolean;
	connectionCount: number;
	connectedClients: string[];
	topics: Record<string, number>;
};

export type SocketMessages = {};

export type SocketTopics = {
	'twitch-chat': any;
};

export class Socket {
	running = $state(false);

	client: WebSocket | null = $state(null);

	topics = $state<Set<string>>(new Set());

	async start() {
		await invoke('start_websocket_server', { port: 49210 });
		const { running } = await invoke<SocketStatus>('get_websocket_server_status');

		this.running = running;
		this.client = await WebSocket.connect('ws://localhost:49210');

		await listen('websocket_message_received', ({ payload }) => {
			console.log('Received message:', payload);
		});

		this.client.addListener((message) => {
			console.log('WebSocket message received:', message);
		});

		// Subscribe to initial topic
		this.subscribe('twitch-chat');
		this.broadcastToTopic('twitch-chat', {
			user: 'streamer',
			message: 'Welcome to the stream!'
		});
	}

	async stop() {
		if (this.client) {
			await this.client.disconnect();
			this.client = null;
		}

		await invoke('stop_websocket_server');
		this.running = false;
		this.topics.clear();
	}

	subscribe(topic: string) {
		if (this.client && !this.topics.has(topic)) {
			this.client.send(
				JSON.stringify({
					type: 'subscribe',
					topic
				})
			);
			this.topics.add(topic);
		}
	}

	unsubscribe(topic: string) {
		if (this.client && this.topics.has(topic)) {
			this.client.send(
				JSON.stringify({
					type: 'unsubscribe',
					topic
				})
			);
			this.topics.delete(topic);
		}
	}

	sendMessage(topic: string, data: any) {
		if (this.client) {
			this.client.send(
				JSON.stringify({
					type: 'message',
					topic,
					data
				})
			);
		}
	}

	broadcast(message: string) {
		return invoke('broadcast_websocket_message', {
			message: JSON.stringify({ type: 'broadcast', message })
		});
	}

	broadcastToTopic(topic: string, data: any) {
		return invoke('broadcast_to_topic', {
			topic,
			data
		});
	}
}

export const socket = new Socket();
