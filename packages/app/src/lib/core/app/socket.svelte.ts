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

/**
 * A single websocket connection to the local relay server.
 */
export class Socket extends Emittery<SocketEvents> {
	#state = $state<SocketState>(SocketState.Disconnected);
	#messageListener?: () => void;
	#subscribedTopics = new Set<string>();

	constructor(private ws: Websocket) {
		super();
		this.#setupListeners();
	}

	get state(): SocketState {
		return this.#state;
	}

	get isConnected(): boolean {
		return this.#state === SocketState.Connected;
	}

	get topics(): ReadonlySet<string> {
		return this.#subscribedTopics;
	}

	/**
	 * Creates a new WebSocket connection.
	 *
	 * @param url WebSocket URL (default: ws://localhost:9842/ws)
	 */
	static async connect(url = 'ws://localhost:9842/ws'): Promise<Socket | null> {
		try {
			const connection = await Websocket.connect(url);
			const socket = new Socket(connection);
			socket.#state = SocketState.Connected;
			setTimeout(() => socket.emit('connected'), 0);
			return socket;
		} catch {
			return null;
		}
	}

	#setupListeners(): void {
		this.#messageListener = this.ws.addListener((msg) => {
			try {
				if (msg.type === 'Text') {
					const parsed = this.#parseMessage(msg.data);

					if (parsed) {
						this.#handleMessage(parsed);
					}
				} else if (msg.type === 'Close') {
					// Server closed the connection: surface it so the manager reconnects.
					this.#state = SocketState.Disconnected;
					this.emit('disconnected');
				}
			} catch (error) {
				console.error('[SOCKET]: Failed to process message:', error);
				this.emit(
					'error',
					error instanceof Error ? error.message : 'Unknown error processing message'
				);
			}
		});
	}

	#parseMessage(data: string): SocketMessage | null {
		try {
			const parsed = JSON.parse(data) as Record<string, unknown>;

			if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
				throw new Error('Invalid message format: missing type field');
			}

			switch (parsed.type) {
				case 'message':
					if (typeof parsed.topic !== 'string' || !('data' in parsed)) {
						throw new Error('Invalid message format: missing topic or data');
					}
					return { type: 'message', topic: parsed.topic, data: parsed.data };

				case 'success':
					if (typeof parsed.message !== 'string') {
						throw new Error('Invalid success format: missing message');
					}
					return { type: 'success', message: parsed.message };

				case 'error':
					if (typeof parsed.message !== 'string') {
						throw new Error('Invalid error format: missing message');
					}
					return { type: 'error', message: parsed.message };

				default:
					console.warn('[SOCKET]: Unknown message type:', parsed.type);
					return null;
			}
		} catch (error) {
			console.error('[SOCKET]: Failed to parse message:', error);
			this.emit('error', error instanceof Error ? error.message : 'Failed to parse message');
			return null;
		}
	}

	#handleMessage(message: SocketMessage): void {
		switch (message.type) {
			case 'message':
				this.emit('message', { topic: message.topic, data: message.data });
				break;
			case 'success':
				break;
			case 'error':
				console.error('[SOCKET]: server error:', message.message);
				this.emit('error', message.message);
				break;
		}
	}

	subscribe(topic: string): void {
		this.#ensureConnected();
		this.#send({ type: 'subscribe', topic });
		this.#subscribedTopics.add(topic);
	}

	unsubscribe(topic: string): void {
		this.#ensureConnected();
		this.#send({ type: 'unsubscribe', topic });
		this.#subscribedTopics.delete(topic);
	}

	publish<T = unknown>(topic: string, data: T): void {
		this.#ensureConnected();

		try {
			JSON.stringify(data);
		} catch {
			throw new SocketError('Data must be JSON serializable', 'INVALID_DATA');
		}

		this.#send({ type: 'publish', topic, data });
	}

	#send(message: OutgoingMessage): void {
		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			this.#state = SocketState.Error;
			throw new SocketError(
				`Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
				'SEND_FAILED'
			);
		}
	}

	#ensureConnected(): void {
		if (!this.isConnected) {
			throw new SocketError('Socket is not connected', 'NOT_CONNECTED');
		}
	}

	async close(): Promise<void> {
		try {
			if (this.#messageListener !== undefined) {
				this.#messageListener();
				this.#messageListener = undefined;
			}

			await this.ws.disconnect();
		} catch {
			// ignore: connection may already be gone
		} finally {
			this.#state = SocketState.Disconnected;
			this.#subscribedTopics.clear();

			setTimeout(() => {
				this.emit('disconnected');
				this.clearListeners();
			}, 0);
		}
	}
}

/**
 * Managed socket with automatic reconnection and topic resubscription.
 *
 * The local relay server starts together with the app; the manager keeps
 * retrying so a slow server start or a dropped connection heals itself.
 */
export class SocketManager extends Emittery<SocketEvents> {
	current = $state<Socket | null>(null);

	#url: string;
	#topics = new Set<string>();
	#retryTimer: ReturnType<typeof setTimeout> | null = null;
	#stopped = true;
	#retryMs = 5_000;

	constructor(url = 'ws://localhost:9842/ws') {
		super();
		this.#url = url;
	}

	get state(): SocketState {
		return this.current?.state ?? SocketState.Disconnected;
	}

	get isConnected(): boolean {
		return this.current?.isConnected ?? false;
	}

	/** Starts the connection loop. Resolves after the first attempt. */
	async start(): Promise<void> {
		this.#stopped = false;
		await this.#connect();
	}

	stop(): void {
		this.#stopped = true;

		if (this.#retryTimer) {
			clearTimeout(this.#retryTimer);
			this.#retryTimer = null;
		}

		void this.current?.close();
		this.current = null;
	}

	async #connect(): Promise<void> {
		if (this.#stopped) {
			return;
		}

		const socket = await Socket.connect(this.#url);

		if (!socket) {
			this.#scheduleReconnect();
			return;
		}

		this.current = socket;

		// Resubscribe topics from before the reconnect.
		for (const topic of this.#topics) {
			try {
				socket.subscribe(topic);
			} catch (error) {
				console.warn('[SOCKET]: resubscribe failed for', topic, error);
			}
		}

		socket.on('message', (message) => this.emit('message', message));
		socket.on('error', (error) => this.emit('error', error));
		socket.on('disconnected', () => {
			if (this.current === socket) {
				this.current = null;
				this.emit('disconnected');
				this.#scheduleReconnect();
			}
		});

		this.emit('connected');
	}

	#scheduleReconnect(): void {
		if (this.#stopped || this.#retryTimer) {
			return;
		}

		this.#retryTimer = setTimeout(() => {
			this.#retryTimer = null;
			void this.#connect();
		}, this.#retryMs);
	}

	/** Subscribes (and resubscribes after reconnects). */
	subscribe(topic: string): void {
		this.#topics.add(topic);

		try {
			this.current?.subscribe(topic);
		} catch (error) {
			console.warn('[SOCKET]: subscribe failed for', topic, error);
		}
	}

	unsubscribe(topic: string): void {
		this.#topics.delete(topic);

		try {
			this.current?.unsubscribe(topic);
		} catch {
			// ignore
		}
	}

	/** Publishes when connected; silently drops otherwise (telemetry-style data). */
	publish<T = unknown>(topic: string, data: T): void {
		try {
			this.current?.publish(topic, data);
		} catch (error) {
			console.warn('[SOCKET]: publish failed for', topic, error);
		}
	}
}
