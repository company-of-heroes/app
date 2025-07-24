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

	topics = $state<Set<string>>(new Set());

	async start() {
		await invoke('start_websocket_server', { port: 49210 });
		const { running } = await invoke<SocketStatus>('get_websocket_server_status');

		this.running = running;
	}

	async stop() {
		await invoke('stop_websocket_server');

		this.topics.clear();
		this.running = false;
	}

	publish(topic: string, data: any) {
		return invoke('broadcast_to_topic', {
			topic,
			data
		});
	}
}

export const socket = new Socket();
