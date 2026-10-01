use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use warp::ws::{Message, WebSocket, Ws};
use warp::{Filter, Reply};

use crate::browser_login::{BrowserLoginQuery, BrowserLoginState, handle_browser_login};
use tauri::AppHandle;

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

/// Starts a lightweight local server on port 9842 (WebSocket + browser login).
pub async fn start_ws_server(
    app: AppHandle,
    browser_login: BrowserLoginState,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting local server on http://127.0.0.1:9842");

    let clients: Clients = Arc::new(DashMap::new());
    let topics: Topics = Arc::new(DashMap::new());

    let clients_filter = warp::any().map(move || clients.clone());
    let topics_filter = warp::any().map(move || topics.clone());

    let ws_route = warp::path("ws")
        .and(warp::header::optional::<String>("origin"))
        .and(warp::ws())
        .and(clients_filter)
        .and(topics_filter)
        .map(|origin: Option<String>, ws: Ws, clients, topics| {
            if !is_allowed_origin(origin.as_deref()) {
                return warp::reply::with_status("Forbidden", warp::http::StatusCode::FORBIDDEN)
                    .into_response();
            }

            ws.on_upgrade(move |socket| handle_client(socket, clients, topics))
                .into_response()
        });

    let browser_login_route = warp::path("auth")
        .and(warp::path("browser-login"))
        .and(warp::query::<BrowserLoginQuery>())
        .and(warp::any().map(move || app.clone()))
        .and(warp::any().map(move || browser_login.clone()))
        .and_then(
            |query: BrowserLoginQuery, app: AppHandle, state: BrowserLoginState| async move {
                Ok::<warp::reply::Response, std::convert::Infallible>(
                    handle_browser_login(query, app, state).await,
                )
            },
        );

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let routes = ws_route.or(browser_login_route).with(cors);

    warp::serve(routes).run(([127, 0, 0, 1], 9842)).await;

    Ok(())
}

/// Browsers send their page's origin with a WebSocket upgrade and CORS does not apply,
/// so any website could otherwise read the live lobby. Allowed: the app itself, local
/// pages and files (OBS browser sources) and our own overlay hosts.
fn is_allowed_origin(origin: Option<&str>) -> bool {
    let Some(origin) = origin else {
        return true;
    };

    if origin == "null" || origin.starts_with("file://") || origin.starts_with("tauri://") {
        return true;
    }

    let host = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
        .map(|rest| rest.split(':').next().unwrap_or(rest));
    matches!(
        host,
        Some(
            "localhost"
                | "127.0.0.1"
                | "tauri.localhost"
                | "asset.localhost"
                | "overlay.coh1stats.com"
                | "api.coh1stats.com"
        )
    )
}

/// Handles a new WebSocket client connection
async fn handle_client(ws: WebSocket, clients: Clients, topics: Topics) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    let client_id = uuid::Uuid::new_v4().to_string();
    let client = Client { sender: tx };

    clients.insert(client_id.clone(), client);
    println!("Client connected: {}", client_id);

    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_tx.send(message).await.is_err() {
                break;
            }
        }
    });

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

    println!("Client disconnected: {}", client_id);
    cleanup_client(&client_id, &clients, &topics);
    send_task.abort();
}

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

fn subscribe_to_topic(client_id: &str, topic: &str, topics: &Topics) {
    topics
        .entry(topic.to_string())
        .or_insert_with(Vec::new)
        .push(client_id.to_string());
}

fn unsubscribe_from_topic(client_id: &str, topic: &str, topics: &Topics) {
    if let Some(mut subscribers) = topics.get_mut(topic) {
        subscribers.retain(|id| id != client_id);
    }
}

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

fn send_to_client(client_id: &str, clients: &Clients, msg: WsMessage) {
    if let Some(client) = clients.get(client_id) {
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = client.sender.send(Message::text(json));
        }
    }
}

fn cleanup_client(client_id: &str, clients: &Clients, topics: &Topics) {
    for mut entry in topics.iter_mut() {
        entry.value_mut().retain(|id| id != client_id);
    }

    topics.retain(|_, subscribers| !subscribers.is_empty());

    clients.remove(client_id);
}

pub fn spawn_ws_server(app: AppHandle, browser_login: BrowserLoginState) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            if let Err(e) = start_ws_server(app, browser_login).await {
                eprintln!("Local server error: {}", e);
            }
        });
    });
}
