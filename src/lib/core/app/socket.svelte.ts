import Websocket from '@tauri-apps/plugin-websocket';
import Emittery from 'emittery';

// Incoming message types from server
export type SocketMessage =
	| { type: 'message'; topic: string; data: unknown }
	| { type: 'success'; message: string }
	| { type: 'error'; message: string };

// Outgoing message types to server
type OutgoingMessage =
	| { type: 'subscribe'; topic: string }
	| { type: 'unsubscribe'; topic: string }
	| { type: 'publish'; topic: string; data: unknown };

export type SocketEvents = {
	connected: undefined;
	disconnected: undefined;
	message: { topic: string; data: unknown };
	error: string;
};

export enum SocketState {
	Connecting = 'connecting',
	Connected = 'connected',
	Disconnected = 'disconnected',
	Error = 'error'
}

export class SocketError extends Error {
	constructor(
		message: string,
		public readonly code?: string
	) {
		super(message);
		this.name = 'SocketError';
	}
}

export class Socket extends Emittery<SocketEvents> {
	private _state = $state<SocketState>(SocketState.Disconnected);
	private messageListener?: () => void;
	private subscribedTopics = new Set<string>();

	constructor(private ws: Websocket) {
		super();
		this.setupListeners();
	}

	get state(): SocketState {
		return this._state;
	}

	get isConnected(): boolean {
		return this._state === SocketState.Connected;
	}

	get topics(): ReadonlySet<string> {
		return this.subscribedTopics;
	}

	/**
	 * Creates a new WebSocket connection
	 * @param url WebSocket URL (default: ws://localhost:9842/ws)
	 * @throws {SocketError} If connection fails
	 */
	static async connect(url = 'ws://localhost:9842/ws'): Promise<Socket> {
		try {
			const connection = await Websocket.connect(url);
			const socket = new Socket(connection);
			socket._state = SocketState.Connected;
			// Use setTimeout to emit after constructor completes
			setTimeout(() => socket.emit('connected'), 0);
			return socket;
		} catch (error) {
			throw new SocketError(
				`Failed to connect to ${url}: ${error instanceof Error ? error.message : String(error)}`,
				'CONNECTION_FAILED'
			);
		}
	}

	/**
	 * Sets up listeners for incoming WebSocket messages
	 */
	private setupListeners(): void {
		this.messageListener = this.ws.addListener((msg) => {
			try {
				if (msg.type === 'Text') {
					const parsed = this.parseMessage(msg.data);
					if (parsed) {
						this.handleMessage(parsed);
					}
				} else {
					console.warn('Received non-string message:', msg);
				}
			} catch (error) {
				console.error('Failed to process message:', error);
				this.emit(
					'error',
					error instanceof Error ? error.message : 'Unknown error processing message'
				);
			}
		});
	}

	/**
	 * Parses and validates incoming JSON messages
	 */
	private parseMessage(data: string): SocketMessage | null {
		try {
			const parsed = JSON.parse(data) as Record<string, unknown>;

			// Validate message structure
			if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
				throw new Error('Invalid message format: missing type field');
			}

			const { type } = parsed;

			switch (type) {
				case 'message':
					if (!('topic' in parsed) || typeof parsed.topic !== 'string') {
						throw new Error('Invalid message format: missing or invalid topic');
					}
					if (!('data' in parsed)) {
						throw new Error('Invalid message format: missing data');
					}
					return { type: 'message', topic: parsed.topic, data: parsed.data };

				case 'success':
					if (!('message' in parsed) || typeof parsed.message !== 'string') {
						throw new Error('Invalid success format: missing or invalid message');
					}
					return { type: 'success', message: parsed.message };

				case 'error':
					if (!('message' in parsed) || typeof parsed.message !== 'string') {
						throw new Error('Invalid error format: missing or invalid message');
					}
					return { type: 'error', message: parsed.message };

				default:
					console.warn('Unknown message type:', type);
					return null;
			}
		} catch (error) {
			console.error('Failed to parse message:', error);
			this.emit('error', error instanceof Error ? error.message : 'Failed to parse message');
			return null;
		}
	}

	/**
	 * Handles validated incoming messages
	 */
	private handleMessage(message: SocketMessage): void {
		switch (message.type) {
			case 'message':
				this.emit('message', { topic: message.topic, data: message.data });
				break;
			case 'success':
				console.log('Socket success:', message.message);
				break;
			case 'error':
				console.error('Socket error:', message.message);
				this.emit('error', message.message);
				break;
		}
	}

	/**
	 * Subscribes to a topic
	 * @param topic Topic name to subscribe to
	 * @throws {SocketError} If not connected
	 */
	subscribe(topic: string): void {
		this.ensureConnected();

		if (!topic || typeof topic !== 'string') {
			throw new SocketError('Topic must be a non-empty string', 'INVALID_TOPIC');
		}

		const message: OutgoingMessage = {
			type: 'subscribe',
			topic
		};

		this.send(message);
		this.subscribedTopics.add(topic);
	}

	/**
	 * Unsubscribes from a topic
	 * @param topic Topic name to unsubscribe from
	 * @throws {SocketError} If not connected
	 */
	unsubscribe(topic: string): void {
		this.ensureConnected();

		if (!topic || typeof topic !== 'string') {
			throw new SocketError('Topic must be a non-empty string', 'INVALID_TOPIC');
		}

		const message: OutgoingMessage = {
			type: 'unsubscribe',
			topic
		};

		this.send(message);
		this.subscribedTopics.delete(topic);
	}

	/**
	 * Publishes data to a topic
	 * @param topic Topic name to publish to
	 * @param data Data to publish (must be JSON serializable)
	 * @throws {SocketError} If not connected or data is not serializable
	 */
	publish<T = unknown>(topic: string, data: T): void {
		this.ensureConnected();

		if (!topic || typeof topic !== 'string') {
			throw new SocketError('Topic must be a non-empty string', 'INVALID_TOPIC');
		}

		// Validate data is JSON serializable
		try {
			JSON.stringify(data);
		} catch (error) {
			throw new SocketError('Data must be JSON serializable', 'INVALID_DATA');
		}

		const message: OutgoingMessage = {
			type: 'publish',
			topic,
			data
		};

		this.send(message);
	}

	/**
	 * Sends a message to the WebSocket server
	 */
	private send(message: OutgoingMessage): void {
		try {
			const serialized = JSON.stringify(message);
			this.ws.send(serialized);
		} catch (error) {
			throw new SocketError(
				`Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
				'SEND_FAILED'
			);
		}
	}

	/**
	 * Ensures the socket is connected before operations
	 */
	private ensureConnected(): void {
		if (!this.isConnected) {
			throw new SocketError('Socket is not connected', 'NOT_CONNECTED');
		}
	}

	/**
	 * Closes the WebSocket connection and cleans up
	 */
	async close(): Promise<void> {
		try {
			// Remove listener if it exists
			if (this.messageListener !== undefined) {
				this.messageListener();
				this.messageListener = undefined;
			}

			await this.ws.disconnect();
			this._state = SocketState.Disconnected;
			this.subscribedTopics.clear();

			// Emit in next tick to avoid issues during cleanup
			setTimeout(() => {
				this.emit('disconnected');
				this.clearListeners();
			}, 0);
		} catch (error) {
			this._state = SocketState.Error;
			throw new SocketError(
				`Failed to close connection: ${error instanceof Error ? error.message : String(error)}`,
				'CLOSE_FAILED'
			);
		}
	}
}
