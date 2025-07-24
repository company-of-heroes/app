<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	let serverStatus = 'Stopped';
	let port = 8080;
	let messages: Array<{ id: string; message: string; timestamp: Date; topic?: string }> = [];
	let connectedClients: string[] = [];
	let serverTopics: Record<string, number> = {};
	let messageToSend = '';
	let topicToSend = 'general';
	let newTopicName = '';
	let ws: WebSocket | null = null;
	let clientConnected = false;
	let clientSubscriptions: Set<string> = new Set();="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	let serverStatus = 'Stopped';
	let port = 49210;
	let messages: Array<{ id: string; message: string; timestamp: Date }> = [];
	let connectedClients: string[] = [];
	let messageToSend = '';
	let ws: WebSocket | null = null;
	let clientConnected = false;

	// Listen for WebSocket events from Tauri
	onMount(async () => {
		// Check initial server status
		await refreshServerStatus();

		// Listen for client connections
		await listen('websocket_client_connected', (event) => {
			const clientId = event.payload as string;
			connectedClients = [...connectedClients, clientId];
			addMessage('system', `Client connected: ${clientId}`);
		});

		// Listen for client disconnections
		await listen('websocket_client_disconnected', (event) => {
			const clientId = event.payload as string;
			connectedClients = connectedClients.filter((id) => id !== clientId);
			addMessage('system', `Client disconnected: ${clientId}`);
		});

		// Listen for received messages
		await listen('websocket_message_received', (event) => {
			const data = event.payload as { client_id: string; message: string };
			addMessage(data.client_id, data.message);
		});
	});

	function addMessage(id: string, message: string, topic?: string) {
		messages = [
			...messages,
			{
				id,
				message,
				topic,
				timestamp: new Date()
			}
		];
		// Auto-scroll to bottom
		setTimeout(() => {
			const messagesContainer = document.getElementById('messages');
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 10);
	}

	async function startServer() {
		try {
			// Check current status first
			const statusResult = (await invoke('get_websocket_server_status')) as {
				running: boolean;
				connection_count: number;
				connected_clients: string[];
			};

			const wasRunning = statusResult.running;
			const result = (await invoke('start_websocket_server', { port })) as string;
			serverStatus = 'Running';

			if (wasRunning) {
				addMessage('system', `Server restarted on port ${port} (was previously running)`);
			} else {
				addMessage('system', result);
			}
		} catch (error) {
			addMessage('system', `Error starting server: ${error}`);
		}
	}

	async function refreshServerStatus() {
		try {
			const statusResult = (await invoke('get_websocket_server_status')) as {
				running: boolean;
				connection_count: number;
				connected_clients: string[];
				topics: Record<string, number>;
			};

			serverStatus = statusResult.running ? 'Running' : 'Stopped';
			connectedClients = statusResult.connected_clients;
			serverTopics = statusResult.topics;

			addMessage(
				'system',
				`Server status: ${serverStatus}, Connected clients: ${statusResult.connection_count}, Topics: ${Object.keys(serverTopics).length}`
			);
		} catch (error) {
			addMessage('system', `Error getting server status: ${error}`);
		}
	}

	async function stopServer() {
		try {
			const result = (await invoke('stop_websocket_server')) as string;
			serverStatus = 'Stopped';
			connectedClients = [];
			addMessage('system', result);

			// Disconnect WebSocket client if connected
			if (ws) {
				ws.close();
				ws = null;
				clientConnected = false;
			}
		} catch (error) {
			addMessage('system', `Error stopping server: ${error}`);
		}
	}

	async function broadcastMessage() {
		if (!messageToSend.trim()) return;

		try {
			await invoke('broadcast_websocket_message', { message: messageToSend });
			addMessage('server', `Broadcasted: ${messageToSend}`);
			messageToSend = '';
		} catch (error) {
			addMessage('system', `Error broadcasting: ${error}`);
		}
	}

	async function broadcastToTopic() {
		if (!messageToSend.trim() || !topicToSend.trim()) return;

		try {
			await invoke('broadcast_to_topic', { 
				topic: topicToSend, 
				data: messageToSend 
			});
			addMessage('server', `Broadcasted to topic "${topicToSend}": ${messageToSend}`);
			messageToSend = '';
		} catch (error) {
			addMessage('system', `Error broadcasting to topic: ${error}`);
		}
	}

	function connectClient() {
		if (ws) {
			ws.close();
		}

		ws = new WebSocket(`ws://localhost:${port}`);

		ws.onopen = () => {
			clientConnected = true;
			addMessage('client', 'Connected to WebSocket server');
		};
        
		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'subscribed') {
					clientSubscriptions.add(data.topic);
					addMessage('client', `Subscribed to topic: ${data.topic}`);
				} else if (data.type === 'unsubscribed') {
					clientSubscriptions.delete(data.topic);
					addMessage('client', `Unsubscribed from topic: ${data.topic}`);
				} else if (data.type === 'message') {
					addMessage('client', `Topic "${data.topic}": ${JSON.stringify(data.data)}`, data.topic);
				} else if (data.type === 'error') {
					addMessage('client', `Error: ${data.message}`);
				} else {
					addMessage('client', `Received: ${event.data}`);
				}
			} catch {
				addMessage('client', `Received: ${event.data}`);
			}
		};

		ws.onclose = () => {
			clientConnected = false;
			clientSubscriptions.clear();
			addMessage('client', 'Disconnected from WebSocket server');
		};

		ws.onerror = (error) => {
			addMessage('client', `WebSocket error: ${error}`);
		};
	}

	function disconnectClient() {
		if (ws) {
			ws.close();
			ws = null;
			clientConnected = false;
			clientSubscriptions.clear();
		}
	}

	function subscribeToTopic(topic: string) {
		if (ws && ws.readyState === WebSocket.OPEN && topic.trim()) {
			ws.send(JSON.stringify({ type: 'subscribe', topic: topic.trim() }));
		}
	}

	function unsubscribeFromTopic(topic: string) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'unsubscribe', topic }));
		}
	}

	function sendClientMessage() {
		if (ws && ws.readyState === WebSocket.OPEN && messageToSend.trim()) {
			const message = {
				type: 'message',
				topic: topicToSend,
				data: messageToSend
			};
			ws.send(JSON.stringify(message));
			addMessage('client', `Sent to topic "${topicToSend}": ${messageToSend}`);
			messageToSend = '';
		}
	}

	function clearMessages() {
		messages = [];
	}
</script>

<div class="container">
	<h1>WebSocket Server Test</h1>

	<div class="controls">
		<div class="server-controls">
			<h2>Server Controls</h2>
			<div class="control-row">
				<label>
					Port:
					<input type="number" bind:value={port} min="1024" max="65535" />
				</label>
				<span class="status" class:running={serverStatus === 'Running'}>
					Status: {serverStatus}
				</span>
			</div>

			<div class="control-row">
				<button on:click={startServer}>
					{serverStatus === 'Running' ? 'Restart Server' : 'Start Server'}
				</button>
				<button on:click={stopServer} disabled={serverStatus === 'Stopped'}> Stop Server </button>
				<button on:click={refreshServerStatus}>Refresh Status</button>
			</div>

			<div class="connected-clients">
				<h3>Connected Clients ({connectedClients.length})</h3>
				<ul>
					{#each connectedClients as client}
						<li>{client}</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="client-controls">
			<h2>Test Client</h2>
			<div class="control-row">
				<button on:click={connectClient} disabled={clientConnected || serverStatus === 'Stopped'}>
					Connect Client
				</button>
				<button on:click={disconnectClient} disabled={!clientConnected}> Disconnect Client </button>
				<span class="status" class:running={clientConnected}>
					{clientConnected ? 'Connected' : 'Disconnected'}
				</span>
			</div>
		</div>
	</div>

	<div class="message-controls">
		<h2>Send Messages</h2>
		<div class="topic-controls">
			<label>
				Topic:
				<input type="text" bind:value={topicToSend} placeholder="Enter topic..." />
			</label>
			<button
				on:click={() => subscribeToTopic(newTopicName)}
				disabled={!clientConnected || !newTopicName.trim()}
			>
				Subscribe to Topic
			</button>
			<input type="text" bind:value={newTopicName} placeholder="New topic name..." />
		</div>
		<div class="input-row">
			<input
				type="text"
				bind:value={messageToSend}
				placeholder="Enter message..."
				on:keydown={(e) =>
					e.key === 'Enter' && (clientConnected ? sendClientMessage() : broadcastToTopic())}
			/>
			<button on:click={broadcastMessage} disabled={serverStatus === 'Stopped'}>
				Broadcast to All
			</button>
			<button
				on:click={broadcastToTopic}
				disabled={serverStatus === 'Stopped' || !topicToSend.trim()}
			>
				Broadcast to Topic
			</button>
			<button on:click={sendClientMessage} disabled={!clientConnected || !topicToSend.trim()}>
				Send from Client
			</button>
		</div>

		<!-- Client Subscriptions -->
		{#if clientConnected && clientSubscriptions.size > 0}
			<div class="subscriptions">
				<h3>Client Subscriptions</h3>
				<div class="subscription-list">
					{#each Array.from(clientSubscriptions) as topic}
						<div class="subscription-item">
							<span>{topic}</span>
							<button on:click={() => unsubscribeFromTopic(topic)}>Unsubscribe</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Server Topics -->
		{#if Object.keys(serverTopics).length > 0}
			<div class="server-topics">
				<h3>Server Topics</h3>
				<div class="topic-list">
					{#each Object.entries(serverTopics) as [topic, count]}
						<div class="topic-item">
							<span>{topic} ({count} subscribers)</span>
							<button
								on:click={() => subscribeToTopic(topic)}
								disabled={!clientConnected || clientSubscriptions.has(topic)}
							>
								{clientSubscriptions.has(topic) ? 'Subscribed' : 'Subscribe'}
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="messages-section">
		<div class="messages-header">
			<h2>Messages</h2>
			<button on:click={clearMessages}>Clear</button>
		</div>
		<div id="messages" class="messages">
			{#each messages as message}
				<div
					class="message"
					class:system={message.id === 'system'}
					class:server={message.id === 'server'}
					class:client={message.id === 'client'}
				>
					<span class="timestamp">{message.timestamp.toLocaleTimeString()}</span>
					<span class="sender">[{message.id}]</span>
					{#if message.topic}
						<span class="topic">#{message.topic}</span>
					{/if}
					<span class="content">{message.message}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		font-family: system-ui, sans-serif;
	}

	h1 {
		color: #333;
		text-align: center;
		margin-bottom: 30px;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 30px;
	}

	.server-controls,
	.client-controls {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
		background: #f9f9f9;
	}

	.control-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 15px;
		flex-wrap: wrap;
	}

	.input-row {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	input[type='number'],
	input[type='text'] {
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
	}

	input[type='text'] {
		flex: 1;
		min-width: 200px;
	}

	button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		background: #007acc;
		color: white;
		cursor: pointer;
		font-size: 14px;
	}

	button:hover:not(:disabled) {
		background: #005a9e;
	}

	button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.status {
		font-weight: bold;
		padding: 4px 8px;
		border-radius: 4px;
		background: #ffebee;
		color: #c62828;
	}

	.status.running {
		background: #e8f5e8;
		color: #2e7d32;
	}

	.connected-clients {
		margin-top: 20px;
	}

	.connected-clients ul {
		list-style: none;
		padding: 0;
		margin: 10px 0;
	}

	.connected-clients li {
		padding: 5px;
		background: #e3f2fd;
		margin: 2px 0;
		border-radius: 3px;
		font-family: monospace;
		font-size: 12px;
	}

	.message-controls {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
		background: #f9f9f9;
		margin-bottom: 20px;
	}

	.messages-section {
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
	}

	.messages-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 15px 20px;
		border-bottom: 1px solid #ddd;
		background: #f5f5f5;
	}

	.messages-header h2 {
		margin: 0;
	}

	.messages {
		height: 400px;
		overflow-y: auto;
		padding: 10px;
	}

	.message {
		display: flex;
		gap: 10px;
		padding: 8px;
		margin-bottom: 4px;
		border-radius: 4px;
		font-size: 14px;
		font-family: monospace;
	}

	.message.system {
		background: #fff3e0;
		border-left: 3px solid #ff9800;
	}

	.message.server {
		background: #e8f5e8;
		border-left: 3px solid #4caf50;
	}

	.message.client {
		background: #e3f2fd;
		border-left: 3px solid #2196f3;
	}

	.timestamp {
		color: #666;
		font-size: 12px;
	}

	.sender {
		font-weight: bold;
		min-width: 60px;
	}

	.content {
		flex: 1;
	}

	h2,
	h3 {
		margin: 0 0 15px 0;
		color: #333;
	}

	.topic {
		background: #f3e5f5;
		color: #7b1fa2;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 12px;
		font-weight: bold;
	}

	.topic-controls,
	.subscriptions,
	.server-topics {
		margin-bottom: 15px;
		padding: 10px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		background: #f9f9f9;
	}

	.subscription-list,
	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 10px;
	}

	.subscription-item,
	.topic-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
	}

	.subscription-item button,
	.topic-item button {
		padding: 3px 8px;
		font-size: 11px;
	}

	@media (max-width: 768px) {
		.controls {
			grid-template-columns: 1fr;
		}

		.control-row,
		.input-row {
			flex-direction: column;
			align-items: stretch;
		}

		input[type='text'] {
			min-width: auto;
		}
	}
</style>
