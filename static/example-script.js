// Example script.js - Standalone WebSocket client usage
// This demonstrates how to connect and interact with the WebSocket server

// First, you need to include websocket-client.js in your HTML:
// <script src="websocket-client.js"></script>

// Create WebSocket connection
const wsClient = new TopicWebSocket('ws://localhost:9842/ws');

// Setup event handlers
wsClient.on('connected', () => {
	console.log('✅ Connected to WebSocket server');

	// Subscribe to topics after connection
	wsClient.subscribe('game-events');
	wsClient.subscribe('player-stats');
	wsClient.subscribe('chat-messages');
});

wsClient.on('disconnected', () => {
	console.log('❌ Disconnected - will auto-reconnect in 5 seconds');
});

wsClient.on('error', (error) => {
	console.error('⚠️ WebSocket error:', error);
});

// Handle incoming messages from subscribed topics
wsClient.on('message', (topic, data) => {
	console.log(`📨 Message from "${topic}":`, data);

	// Route messages based on topic
	switch (topic) {
		case 'game-events':
			handleGameEvent(data);
			break;
		case 'player-stats':
			handlePlayerStats(data);
			break;
		case 'chat-messages':
			handleChatMessage(data);
			break;
		default:
			console.log('Unknown topic:', topic);
	}
});

// Example handlers for different topics
function handleGameEvent(data) {
	console.log('🎮 Game Event:', data);

	// Example: Update UI based on game events
	if (data.event === 'match-start') {
		console.log('Match started!');
		// Update your UI here
	} else if (data.event === 'match-end') {
		console.log('Match ended!');
		// Update your UI here
	}
}

function handlePlayerStats(data) {
	console.log('📊 Player Stats:', data);

	// Example: Update stats display
	if (data.player && data.score !== undefined) {
		console.log(`${data.player} has ${data.score} points`);
		// Update stats in your UI
	}
}

function handleChatMessage(data) {
	console.log('💬 Chat Message:', data);

	// Example: Display chat message
	if (data.user && data.message) {
		console.log(`${data.user}: ${data.message}`);
		// Add to chat display
	}
}

// Example: Publishing messages
function sendGameEvent(eventType, eventData) {
	wsClient.publish('game-events', {
		event: eventType,
		timestamp: Date.now(),
		...eventData
	});
}

function sendPlayerStats(playerName, stats) {
	wsClient.publish('player-stats', {
		player: playerName,
		timestamp: Date.now(),
		...stats
	});
}

function sendChatMessage(user, message) {
	wsClient.publish('chat-messages', {
		user: user,
		message: message,
		timestamp: Date.now()
	});
}

// Example usage - Call these functions from your application
// setTimeout(() => {
//     sendGameEvent('match-start', { mapName: 'Tournament Map' });
//     sendPlayerStats('Player1', { score: 100, kills: 5 });
//     sendChatMessage('Admin', 'Welcome to the game!');
// }, 2000);

// Export for use in other modules (if using module system)
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		wsClient,
		sendGameEvent,
		sendPlayerStats,
		sendChatMessage
	};
}

// Make available globally (browser)
if (typeof window !== 'undefined') {
	window.wsClient = wsClient;
	window.sendGameEvent = sendGameEvent;
	window.sendPlayerStats = sendPlayerStats;
	window.sendChatMessage = sendChatMessage;
}
