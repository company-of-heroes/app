use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use warp::ws::{Message, WebSocket, Ws};
use warp::Filter;

type Clients = Arc<DashMap<String, Client>>;
type Topics = Arc<DashMap<String, Vec<String>>>;

#[derive(Debug, Clone)]
struct Client {
    sender: mpsc::UnboundedSender<Message>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum WsMessage {
    Subscribe {
        topic: String,
    },
    Unsubscribe {
        topic: String,
    },
    Publish {
        topic: String,
        data: serde_json::Value,
    },
    Error {
        message: String,
    },
    Success {
        message: String,
    },
}

/// Starts a lightweight WebSocket server on port 9842
pub async fn start_ws_server() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting WebSocket server on ws://localhost:9842/ws");

    let clients: Clients = Arc::new(DashMap::new());
    let topics: Topics = Arc::new(DashMap::new());

    let clients_filter = warp::any().map(move || clients.clone());
    let topics_filter = warp::any().map(move || topics.clone());

    // WebSocket route
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(clients_filter)
        .and(topics_filter)
        .map(|ws: Ws, clients, topics| {
            ws.on_upgrade(move |socket| handle_client(socket, clients, topics))
        });

    // Add CORS headers
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let routes = ws_route.with(cors);

    // Start the server on port 9842
    warp::serve(routes).run(([127, 0, 0, 1], 9842)).await;

    Ok(())
}

/// Handles a new WebSocket client connection
async fn handle_client(ws: WebSocket, clients: Clients, topics: Topics) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Generate unique client ID
    let client_id = uuid::Uuid::new_v4().to_string();
    let client = Client { sender: tx };

    // Store the client
    clients.insert(client_id.clone(), client);
    println!("Client connected: {}", client_id);

    // Task to send messages to the client
    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_tx.send(message).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from the client
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                if let Err(e) = handle_message(msg, &client_id, &clients, &topics).await {
                    eprintln!("Error handling message: {}", e);
                }
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
        }
    }

    // Client disconnected - cleanup
    println!("Client disconnected: {}", client_id);
    cleanup_client(&client_id, &clients, &topics);
    send_task.abort();
}

/// Handles individual messages from a client
async fn handle_message(
    msg: Message,
    client_id: &str,
    clients: &Clients,
    topics: &Topics,
) -> Result<(), Box<dyn std::error::Error>> {
    if msg.is_text() {
        let text = msg
            .to_str()
            .map_err(|_| "Failed to convert message to string")?;
        match serde_json::from_str::<WsMessage>(text) {
            Ok(ws_msg) => match ws_msg {
                WsMessage::Subscribe { topic } => {
                    subscribe_to_topic(client_id, &topic, topics);
                    send_to_client(
                        client_id,
                        clients,
                        WsMessage::Success {
                            message: format!("Subscribed to topic: {}", topic),
                        },
                    );
                    println!("Client {} subscribed to topic: {}", client_id, topic);
                }
                WsMessage::Unsubscribe { topic } => {
                    unsubscribe_from_topic(client_id, &topic, topics);
                    send_to_client(
                        client_id,
                        clients,
                        WsMessage::Success {
                            message: format!("Unsubscribed from topic: {}", topic),
                        },
                    );
                    println!("Client {} unsubscribed from topic: {}", client_id, topic);
                }
                WsMessage::Publish { topic, data } => {
                    broadcast_to_topic(&topic, &data, topics, clients).await;
                    println!("Message published to topic: {}", topic);
                }
                _ => {}
            },
            Err(e) => {
                send_to_client(
                    client_id,
                    clients,
                    WsMessage::Error {
                        message: format!("Invalid message format: {}", e),
                    },
                );
            }
        }
    }
    Ok(())
}

/// Subscribe a client to a topic
fn subscribe_to_topic(client_id: &str, topic: &str, topics: &Topics) {
    topics
        .entry(topic.to_string())
        .or_insert_with(Vec::new)
        .push(client_id.to_string());
}

/// Unsubscribe a client from a topic
fn unsubscribe_from_topic(client_id: &str, topic: &str, topics: &Topics) {
    if let Some(mut subscribers) = topics.get_mut(topic) {
        subscribers.retain(|id| id != client_id);
    }
}

/// Broadcast a message to all subscribers of a topic
async fn broadcast_to_topic(
    topic: &str,
    data: &serde_json::Value,
    topics: &Topics,
    clients: &Clients,
) {
    if let Some(subscribers) = topics.get(topic) {
        let message = serde_json::json!({
            "type": "message",
            "topic": topic,
            "data": data
        });

        let msg_text = serde_json::to_string(&message).unwrap();
        let ws_message = Message::text(msg_text);

        for client_id in subscribers.value() {
            if let Some(client) = clients.get(client_id) {
                let _ = client.sender.send(ws_message.clone());
            }
        }
    }
}

/// Send a message to a specific client
fn send_to_client(client_id: &str, clients: &Clients, msg: WsMessage) {
    if let Some(client) = clients.get(client_id) {
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = client.sender.send(Message::text(json));
        }
    }
}

/// Clean up client subscriptions when they disconnect
fn cleanup_client(client_id: &str, clients: &Clients, topics: &Topics) {
    // Remove client from all topics
    for mut entry in topics.iter_mut() {
        entry.value_mut().retain(|id| id != client_id);
    }

    // Remove empty topics
    topics.retain(|_, subscribers| !subscribers.is_empty());

    // Remove client
    clients.remove(client_id);
}

/// Spawns the WebSocket server in a background thread with its own runtime
pub fn spawn_ws_server() {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            if let Err(e) = start_ws_server().await {
                eprintln!("WebSocket server error: {}", e);
            }
        });
    });
}
