import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Bootable } from './bootable.svelte';

export type SocketStatus = {
	running: boolean;
	connection_count: number;
	connected_clients: string[];
	topics: Record<string, number>;
};

export type SocketMessage = {
	topic: string;
	data: any;
};

export type WebSocketEvent = {
	client_id: string;
	topic: string;
	message: any;
};

export type SocketTopics = {
	'twitch-chat': any;
	// Add more topic types as needed
};

/**
 * WebSocket server manager for handling real-time communication.
 * Provides a reactive interface to the Tauri WebSocket server backend.
 *
 * @extends {Bootable}
 */
export class Socket extends Bootable {
	/**
	 * Reactive state indicating whether the WebSocket server is running.
	 *
	 * @private
	 * @type {boolean}
	 */
	private _running = $state(false);

	/**
	 * Reactive state tracking the number of connected clients.
	 *
	 * @private
	 * @type {number}
	 */
	private _connectionCount = $state(0);

	/**
	 * Reactive state holding the list of connected client IDs.
	 *
	 * @private
	 * @type {string[]}
	 */
	private _connectedClients = $state<string[]>([]);

	/**
	 * Reactive state mapping topic names to their subscriber counts.
	 *
	 * @private
	 * @type {Map<string, number>}
	 */
	private _topics = $state<Map<string, number>>(new Map());

	/**
	 * Array of event listener cleanup functions for proper resource management.
	 *
	 * @private
	 * @type {UnlistenFn[]}
	 */
	private eventUnlisteners: UnlistenFn[] = [];

	/**
	 * The port number on which the WebSocket server will listen.
	 *
	 * @private
	 * @type {number}
	 */
	private port: number;

	/**
	 * Creates a new Socket instance.
	 *
	 * @constructor
	 * @param {number} [port=49210] - The port number for the WebSocket server
	 */
	constructor(port: number = 49210) {
		super();
		this.port = port;
	}

	/**
	 * Getter for the WebSocket server running state.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	get running() {
		return this._running;
	}

	/**
	 * Getter for the number of connected clients.
	 *
	 * @readonly
	 * @type {number}
	 */
	get connectionCount() {
		return this._connectionCount;
	}

	/**
	 * Getter for the list of connected client IDs.
	 * Returns a copy to prevent external modification.
	 *
	 * @readonly
	 * @type {string[]}
	 */
	get connectedClients() {
		return [...this._connectedClients];
	}

	/**
	 * Getter for the topics map.
	 * Returns a copy to prevent external modification.
	 *
	 * @readonly
	 * @type {Map<string, number>}
	 */
	get topics() {
		return new Map(this._topics);
	}

	/**
	 * Initializes and starts the WebSocket server.
	 * Sets up event listeners for real-time updates from the Tauri backend.
	 *
	 * @public
	 * @async
	 * @returns {Promise<this>} The Socket instance for method chaining
	 * @throws {Error} When server startup or initialization fails
	 */
	async boot(): Promise<this> {
		try {
			// Start the WebSocket server
			await invoke('start_websocket_server', { port: this.port });

			// Get initial status
			await this.refreshStatus();

			// Set up event listeners for real-time updates
			await this.setupEventListeners();

			return this;
		} catch (error) {
			console.error('Failed to boot WebSocket server:', error);
			throw error;
		}
	}

	/**
	 * Shuts down the WebSocket server and cleans up all resources.
	 * Removes event listeners and resets internal state.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 * @throws {Error} When server shutdown fails
	 */
	async shutdown(): Promise<void> {
		try {
			// Clean up event listeners
			await this.cleanupEventListeners();

			// Stop the WebSocket server
			await invoke('stop_websocket_server');

			// Reset state
			this.resetState();
		} catch (error) {
			console.error('Failed to shutdown WebSocket server:', error);
			throw error;
		}
	}

	/**
	 * Alias for shutdown to match the Bootable interface.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	async stop(): Promise<void> {
		return this.shutdown();
	}

	/**
	 * Publishes a message to a specific topic.
	 * All clients subscribed to the topic will receive the message.
	 *
	 * @public
	 * @async
	 * @param {string} topic - The topic to publish the message to
	 * @param {any} data - The data to send to subscribers
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} When message publishing fails
	 */
	async publish(topic: string, data: any): Promise<void> {
		try {
			await invoke('broadcast_to_topic', { topic, data });
		} catch (error) {
			console.error(`Failed to publish to topic '${topic}':`, error);
			throw error;
		}
	}

	/**
	 * Broadcasts a message to all connected clients regardless of topic subscriptions.
	 *
	 * @public
	 * @async
	 * @param {string} message - The message to broadcast to all clients
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} When broadcasting fails
	 */
	async broadcast(message: string): Promise<void> {
		try {
			await invoke('broadcast_websocket_message', { message });
		} catch (error) {
			console.error('Failed to broadcast message:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the current server status from the Tauri backend and updates reactive state.
	 * This includes connection count, connected clients, and topic information.
	 *
	 * @public
	 * @async
	 *
	 * @returns {Promise<SocketStatus>} The current server status
	 * @throws {Error} When status retrieval fails
	 */
	async refreshStatus(): Promise<SocketStatus> {
		try {
			const status = await invoke<SocketStatus>('get_websocket_server_status');

			// Update reactive state
			this._running = status.running;
			this._connectionCount = status.connection_count;
			this._connectedClients = [...status.connected_clients];
			this._topics = new Map(Object.entries(status.topics));

			return status;
		} catch (error) {
			console.error('Failed to get WebSocket server status:', error);
			throw error;
		}
	}

	/**
	 * Checks if a specific topic has any subscribers.
	 *
	 * @public
	 * @param {string} topic - The topic name to check
	 *
	 * @returns {boolean} True if the topic has subscribers, false otherwise
	 */
	/**
	 * Checks if a specific topic has any subscribers.
	 *
	 * @public
	 * @param {string} topic - The topic name to check
	 *
	 * @returns {boolean} True if the topic has subscribers, false otherwise
	 */
	hasSubscribers(topic: string): boolean {
		return (this._topics.get(topic) ?? 0) > 0;
	}

	/**
	 * Gets the number of subscribers for a specific topic.
	 *
	 * @public
	 * @param {string} topic - The topic name to get subscriber count for
	 *
	 * @returns {number} The number of subscribers for the topic
	 */
	getSubscriberCount(topic: string): number {
		return this._topics.get(topic) ?? 0;
	}

	/**
	 * Sets up event listeners for real-time updates from the Tauri backend.
	 * Listens for client connections, disconnections, and incoming messages.
	 *
	 * @private
	 * @async
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} When event listener setup fails
	 */
	/**
	 * Sets up event listeners for real-time updates from the Tauri backend.
	 * Listens for client connections, disconnections, and incoming messages.
	 *
	 * @private
	 * @async
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} When event listener setup fails
	 */
	private async setupEventListeners(): Promise<void> {
		try {
			// Listen for client connections
			const connectionListener = await listen('websocket_client_connected', (event) => {
				const clientId = event.payload as string;
				if (!this._connectedClients.includes(clientId)) {
					this._connectedClients = [...this._connectedClients, clientId];
					this._connectionCount = this._connectedClients.length;
				}
			});

			// Listen for client disconnections
			const disconnectionListener = await listen('websocket_client_disconnected', (event) => {
				const clientId = event.payload as string;
				this._connectedClients = this._connectedClients.filter((id) => id !== clientId);
				this._connectionCount = this._connectedClients.length;
			});

			// Listen for incoming messages
			const messageListener = await listen('websocket_message_received', (event) => {
				const message = event.payload as WebSocketEvent;
				this.handleIncomingMessage(message);
			});

			this.eventUnlisteners = [connectionListener, disconnectionListener, messageListener];
		} catch (error) {
			console.error('Failed to setup event listeners:', error);
			throw error;
		}
	}

	/**
	 * Cleans up all event listeners to prevent memory leaks.
	 *
	 * @private
	 * @async
	 *
	 * @returns {Promise<void>}
	 */
	/**
	 * Cleans up all event listeners to prevent memory leaks.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>}
	 */
	private async cleanupEventListeners(): Promise<void> {
		for (const unlisten of this.eventUnlisteners) {
			unlisten();
		}
		this.eventUnlisteners = [];
	}

	/**
	 * Resets all internal state to default values.
	 * Called during shutdown to ensure clean state.
	 *
	 * @private
	 *
	 * @returns {void}
	 */
	private resetState(): void {
		this._running = false;
		this._connectionCount = 0;
		this._connectedClients = [];
		this._topics.clear();
	}

	/**
	 * Handles incoming WebSocket messages from clients.
	 * Override this method in subclasses or extend for custom message handling logic.
	 *
	 * @private
	 * @param {WebSocketEvent} message - The incoming message event
	 *
	 * @returns {void}
	 */
	private handleIncomingMessage(message: WebSocketEvent): void {
		// Override this method in subclasses or add event handling logic
		console.log('Received WebSocket message:', message);
	}
}
