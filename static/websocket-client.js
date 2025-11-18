/**
 * Lightweight WebSocket Client for Topic-based Pub/Sub
 *
 * Usage Example:
 *
 * const ws = new TopicWebSocket('ws://localhost:9842/ws');
 *
 * ws.on('connected', () => {
 *     console.log('Connected!');
 *     ws.subscribe('game-events');
 *     ws.subscribe('player-stats');
 * });
 *
 * ws.on('message', (topic, data) => {
 *     console.log(`Received on ${topic}:`, data);
 * });
 *
 * ws.publish('game-events', { event: 'player-joined', player: 'John' });
 */

class TopicWebSocket {
	constructor(url = 'ws://localhost:9842/ws') {
		this.url = url;
		this.ws = null;
		this.reconnectInterval = 5000;
		this.reconnectTimer = null;
		this.listeners = {
			connected: [],
			disconnected: [],
			message: [],
			error: []
		};
		this.connect();
	}

	connect() {
		try {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				if (this.reconnectTimer) {
					clearTimeout(this.reconnectTimer);
					this.reconnectTimer = null;
				}
				this.emit('connected');
			};

			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
				this.emit('disconnected');
				this.reconnect();
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				this.emit('error', error);
			};

			this.ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (error) {
					console.error('Failed to parse message:', error);
				}
			};
		} catch (error) {
			console.error('Failed to connect:', error);
			this.reconnect();
		}
	}

	reconnect() {
		if (this.reconnectTimer) return;

		console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, this.reconnectInterval);
	}

	handleMessage(message) {
		switch (message.type) {
			case 'message':
				this.emit('message', message.topic, message.data);
				break;
			case 'success':
				console.log('Success:', message.message);
				break;
			case 'error':
				console.error('Error:', message.message);
				this.emit('error', message.message);
				break;
		}
	}

	subscribe(topic) {
		if (!this.isConnected()) {
			console.warn('Cannot subscribe: WebSocket not connected');
			return;
		}

		const message = {
			type: 'subscribe',
			topic: topic
		};

		this.send(message);
	}

	unsubscribe(topic) {
		if (!this.isConnected()) {
			console.warn('Cannot unsubscribe: WebSocket not connected');
			return;
		}

		const message = {
			type: 'unsubscribe',
			topic: topic
		};

		this.send(message);
	}

	publish(topic, data) {
		if (!this.isConnected()) {
			console.warn('Cannot publish: WebSocket not connected');
			return;
		}

		const message = {
			type: 'publish',
			topic: topic,
			data: data
		};

		this.send(message);
	}

	send(message) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.error('WebSocket is not open');
		}
	}

	on(event, callback) {
		if (this.listeners[event]) {
			this.listeners[event].push(callback);
		}
	}

	off(event, callback) {
		if (this.listeners[event]) {
			this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
		}
	}

	emit(event, ...args) {
		if (this.listeners[event]) {
			this.listeners[event].forEach((callback) => callback(...args));
		}
	}

	isConnected() {
		return this.ws && this.ws.readyState === WebSocket.OPEN;
	}

	close() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.close();
		}
	}
}

// Example usage for browser/node environment
if (typeof window !== 'undefined') {
	window.TopicWebSocket = TopicWebSocket;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = TopicWebSocket;
}
