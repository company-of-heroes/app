use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::{fs, env};
use tauri::Manager;
use tauri::{command, Emitter, Window, AppHandle};
use tauri_plugin_oauth::start;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe { topic: String },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { topic: String },
    #[serde(rename = "message")]
    Message {
        topic: String,
        data: serde_json::Value,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "subscribed")]
    Subscribed { topic: String },
    #[serde(rename = "unsubscribed")]
    Unsubscribed { topic: String },
    #[serde(rename = "message")]
    Message {
        topic: String,
        data: serde_json::Value,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone)]
struct ClientConnection {
    id: String,
    sender: tokio::sync::mpsc::UnboundedSender<String>,
    subscriptions: Arc<Mutex<HashSet<String>>>,
}

// Helper function to get the overlays directory using Tauri's app data directory
fn get_overlays_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    Ok(app_data_dir.join("overlays"))
}

// Simple HTTP server for serving overlay files
async fn handle_overlay_request(mut stream: TcpStream, app_handle: AppHandle) -> Result<(), std::io::Error> {
    let mut buffer = [0; 1024];
    let n = stream.read(&mut buffer).await?;
    let request = String::from_utf8_lossy(&buffer[..n]);
    
    let lines: Vec<&str> = request.lines().collect();
    if lines.is_empty() {
        return Ok(());
    }
    
    let request_line = lines[0];
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    
    if parts.len() < 2 {
        return Ok(());
    }
    
    let path = parts[1];
    
    // Serve files directly from overlays directory
    // Remove leading slash if present
    let file_path_str = if path.starts_with("/overlays/") {
        &path[10..] // Remove "/overlays/"
    } else if path.starts_with("/") {
        &path[1..] // Remove leading "/"
    } else {
        path
    };
    
    let overlays_dir = match get_overlays_dir(&app_handle) {
        Ok(dir) => dir,
        Err(_) => {
            let response = "HTTP/1.1 500 Internal Server Error\r\n\r\n";
            stream.write_all(response.as_bytes()).await?;
            return Ok(());
        }
    };
    
    let file_path = overlays_dir.join(file_path_str);
    
    // Security check: ensure the path is within the overlays directory
    if !file_path.starts_with(&overlays_dir) {
        let response = "HTTP/1.1 403 Forbidden\r\n\r\n";
        stream.write_all(response.as_bytes()).await?;
        return Ok(());
    }
    
    match fs::read(&file_path) {
        Ok(content) => {
            let mime_type = match file_path.extension().and_then(|ext| ext.to_str()) {
                Some("html") => "text/html",
                Some("css") => "text/css",
                Some("js") => "application/javascript",
                Some("json") => "application/json",
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("gif") => "image/gif",
                Some("svg") => "image/svg+xml",
                Some("woff") | Some("woff2") => "font/woff2",
                Some("ttf") => "font/ttf",
                Some("otf") => "font/otf",
                _ => "text/plain",
            };
            
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\n\r\n",
                mime_type,
                content.len()
            );
            stream.write_all(response.as_bytes()).await?;
            stream.write_all(&content).await?;
        }
        Err(_) => {
            let response = "HTTP/1.1 404 Not Found\r\n\r\n";
            stream.write_all(response.as_bytes()).await?;
        }
    }
    
    Ok(())
}

async fn start_overlay_http_server(app_handle: AppHandle) {
    let addr = "127.0.0.1:49220";
    let listener = match TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("Failed to bind overlay HTTP server to {}: {}", addr, e);
            return;
        }
    };
    
    println!("Overlay HTTP server listening on: http://{}", addr);
    
    while let Ok((stream, _)) = listener.accept().await {
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_overlay_request(stream, app_handle_clone).await {
                eprintln!("Error handling overlay HTTP request: {}", e);
            }
        });
    }
}

#[command]
async fn start_server(window: Window) -> Result<u16, String> {
    start(move |url| {
        // Because of the unprotected localhost port, you must verify the URL here.
        // Preferebly send back only the token, or nothing at all if you can handle everything else in Rust.
        let _ = window.emit("redirect_uri", url);
    })
    .map_err(|err| err.to_string())
}

#[tauri::command]
async fn get_active_window_title() -> Result<String, String> {
    use windows::{
        Win32::Foundation::HWND,
        Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW},
    };

    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        let mut buffer = [0u16; 512];
        let length = GetWindowTextW(hwnd, &mut buffer);
        if length > 0 {
            Ok(String::from_utf16_lossy(&buffer[..length as usize]))
        } else {
            Err("Kan venstertitel niet ophalen".into())
        }
    }
}

// WebSocket server state
#[derive(Default)]
struct WebSocketState {
    connections: Arc<Mutex<HashMap<String, ClientConnection>>>,
    topics: Arc<Mutex<HashMap<String, HashSet<String>>>>, // topic -> set of client_ids
    server_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

#[command]
async fn start_websocket_server(
    port: u16,
    state: tauri::State<'_, WebSocketState>,
    window: Window,
) -> Result<String, String> {
    // Check if server is already running and stop it first
    {
        let mut handle = state.server_handle.lock().unwrap();
        if let Some(server_handle) = handle.take() {
            server_handle.abort();

            // Clear all connections
            let mut connections = state.connections.lock().unwrap();
            connections.clear();
            let mut topics = state.topics.lock().unwrap();
            topics.clear();
            drop(connections); // Release the lock before continuing
            drop(topics);

            println!("Stopped existing WebSocket server to restart on new port");
        }
    }

    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    let addr_clone = addr.clone(); // Clone for the return message
    let connections = state.connections.clone();
    let topics = state.topics.clone();
    let handle = tokio::spawn(async move {
        println!("WebSocket server listening on: {}", addr);

        while let Ok((stream, addr)) = listener.accept().await {
            let connections = connections.clone();
            let topics = topics.clone();
            let window = window.clone();

            tokio::spawn(async move {
                if let Err(e) = handle_connection(stream, addr, connections, topics, window).await {
                    eprintln!("Error handling connection {}: {}", addr, e);
                }
            });
        }
    });

    // Store the server handle
    {
        let mut server_handle = state.server_handle.lock().unwrap();
        *server_handle = Some(handle);
    }

    Ok(format!("WebSocket server started on {}", addr_clone))
}

#[command]
async fn stop_websocket_server(state: tauri::State<'_, WebSocketState>) -> Result<String, String> {
    let mut handle = state.server_handle.lock().unwrap();

    if let Some(server_handle) = handle.take() {
        server_handle.abort();

        // Clear all connections
        let mut connections = state.connections.lock().unwrap();
        connections.clear();
        let mut topics = state.topics.lock().unwrap();
        topics.clear();

        Ok("WebSocket server stopped".to_string())
    } else {
        Err("WebSocket server is not running".to_string())
    }
}

#[command]
async fn broadcast_websocket_message(
    message: String,
    state: tauri::State<'_, WebSocketState>,
) -> Result<String, String> {
    let connections = state.connections.lock().unwrap();
    let mut disconnected = Vec::new();

    for (id, connection) in connections.iter() {
        if connection.sender.send(message.clone()).is_err() {
            disconnected.push(id.clone());
        }
    }

    // Remove disconnected clients
    drop(connections);
    if !disconnected.is_empty() {
        let mut connections = state.connections.lock().unwrap();
        for id in disconnected {
            connections.remove(&id);
        }
    }

    Ok("Message broadcasted".to_string())
}

#[command]
async fn broadcast_to_topic(
    topic: String,
    data: serde_json::Value,
    state: tauri::State<'_, WebSocketState>,
) -> Result<String, String> {
    let message = ServerMessage::Message {
        topic: topic.clone(),
        data,
    };
    let message_json = serde_json::to_string(&message).map_err(|e| e.to_string())?;

    let topics = state.topics.lock().unwrap();
    let connections = state.connections.lock().unwrap();

    if let Some(client_ids) = topics.get(&topic) {
        let mut sent_count = 0;
        let mut disconnected = Vec::new();

        for client_id in client_ids {
            if let Some(connection) = connections.get(client_id) {
                if connection.sender.send(message_json.clone()).is_ok() {
                    sent_count += 1;
                } else {
                    disconnected.push(client_id.clone());
                }
            }
        }

        // Clean up disconnected clients
        drop(connections);
        drop(topics);

        if !disconnected.is_empty() {
            let mut connections = state.connections.lock().unwrap();
            let mut topics = state.topics.lock().unwrap();

            for client_id in disconnected {
                connections.remove(&client_id);
                // Remove from all topics
                for (_, subscribers) in topics.iter_mut() {
                    subscribers.remove(&client_id);
                }
            }
        }

        Ok(format!(
            "Message sent to {} subscribers of topic '{}'",
            sent_count, topic
        ))
    } else {
        Ok(format!("No subscribers for topic '{}'", topic))
    }
}
#[command]
async fn get_websocket_server_status(
    state: tauri::State<'_, WebSocketState>,
) -> Result<serde_json::Value, String> {
    let handle = state.server_handle.lock().unwrap();
    let connections = state.connections.lock().unwrap();
    let topics = state.topics.lock().unwrap();

    let is_running = handle.is_some();
    let connection_count = connections.len();
    let connected_clients: Vec<String> = connections.keys().cloned().collect();
    let topic_info: HashMap<String, usize> = topics
        .iter()
        .map(|(topic, subscribers)| (topic.clone(), subscribers.len()))
        .collect();

    Ok(serde_json::json!({
        "running": is_running,
        "connection_count": connection_count,
        "connected_clients": connected_clients,
        "topics": topic_info
    }))
}

async fn handle_connection(
    raw_stream: TcpStream,
    addr: SocketAddr,
    connections: Arc<Mutex<HashMap<String, ClientConnection>>>,
    topics: Arc<Mutex<HashMap<String, HashSet<String>>>>,
    window: Window,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_async(raw_stream).await?;
    println!("New WebSocket connection: {}", addr);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    let client_id = addr.to_string();
    let client_subscriptions = Arc::new(Mutex::new(HashSet::new()));

    let client_connection = ClientConnection {
        id: client_id.clone(),
        sender: tx,
        subscriptions: client_subscriptions.clone(),
    };

    // Add connection to the map
    {
        let mut connections = connections.lock().unwrap();
        connections.insert(client_id.clone(), client_connection);
    }

    // Emit connection event to frontend
    let _ = window.emit("websocket_client_connected", &client_id);

    // Handle outgoing messages
    let outgoing = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_sender
                .send(tokio_tungstenite::tungstenite::Message::Text(message))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    // Handle incoming messages
    let window_clone = window.clone();
    let client_id_clone2 = client_id.clone();
    let connections_clone = connections.clone();
    let topics_clone = topics.clone();
    let client_subscriptions_clone = client_subscriptions.clone();

    let incoming = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                    // Try to parse as ClientMessage
                    match serde_json::from_str::<ClientMessage>(&text) {
                        Ok(client_msg) => {
                            match client_msg {
                                ClientMessage::Subscribe { topic } => {
                                    // Add client to topic
                                    {
                                        let mut topics = topics_clone.lock().unwrap();
                                        topics
                                            .entry(topic.clone())
                                            .or_insert_with(HashSet::new)
                                            .insert(client_id_clone2.clone());

                                        let mut subscriptions =
                                            client_subscriptions_clone.lock().unwrap();
                                        subscriptions.insert(topic.clone());
                                    }

                                    // Send confirmation back to client
                                    if let Ok(connections) = connections_clone.lock() {
                                        if let Some(connection) = connections.get(&client_id_clone2)
                                        {
                                            let response = ServerMessage::Subscribed {
                                                topic: topic.clone(),
                                            };
                                            if let Ok(response_json) =
                                                serde_json::to_string(&response)
                                            {
                                                let _ = connection.sender.send(response_json);
                                            }
                                        }
                                    }

                                    println!(
                                        "Client {} subscribed to topic: {}",
                                        client_id_clone2, topic
                                    );
                                }
                                ClientMessage::Unsubscribe { topic } => {
                                    // Remove client from topic
                                    {
                                        let mut topics = topics_clone.lock().unwrap();
                                        if let Some(subscribers) = topics.get_mut(&topic) {
                                            subscribers.remove(&client_id_clone2);
                                            if subscribers.is_empty() {
                                                topics.remove(&topic);
                                            }
                                        }

                                        let mut subscriptions =
                                            client_subscriptions_clone.lock().unwrap();
                                        subscriptions.remove(&topic);
                                    }

                                    // Send confirmation back to client
                                    if let Ok(connections) = connections_clone.lock() {
                                        if let Some(connection) = connections.get(&client_id_clone2)
                                        {
                                            let response = ServerMessage::Unsubscribed {
                                                topic: topic.clone(),
                                            };
                                            if let Ok(response_json) =
                                                serde_json::to_string(&response)
                                            {
                                                let _ = connection.sender.send(response_json);
                                            }
                                        }
                                    }

                                    println!(
                                        "Client {} unsubscribed from topic: {}",
                                        client_id_clone2, topic
                                    );
                                }
                                ClientMessage::Message { topic, data } => {
                                    // Emit received message to frontend
                                    let _ = window_clone.emit(
                                        "websocket_message_received",
                                        serde_json::json!({
                                            "client_id": client_id_clone2,
                                            "topic": topic,
                                            "message": data
                                        }),
                                    );
                                }
                            }
                        }
                        Err(_) => {
                            // Send error response
                            if let Ok(connections) = connections_clone.lock() {
                                if let Some(connection) = connections.get(&client_id_clone2) {
                                    let response = ServerMessage::Error {
                                        message: "Invalid message format".to_string(),
                                    };
                                    if let Ok(response_json) = serde_json::to_string(&response) {
                                        let _ = connection.sender.send(response_json);
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                    println!("Client {} disconnected", client_id_clone2);
                    break;
                }
                Err(e) => {
                    eprintln!("WebSocket error for client {}: {}", client_id_clone2, e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = outgoing => {},
        _ = incoming => {},
    }

    // Clean up: remove connection and subscriptions
    {
        let mut connections = connections.lock().unwrap();
        connections.remove(&client_id);

        let mut topics = topics.lock().unwrap();
        let subscriptions = client_subscriptions.lock().unwrap();

        // Remove client from all subscribed topics
        for topic in subscriptions.iter() {
            if let Some(subscribers) = topics.get_mut(topic) {
                subscribers.remove(&client_id);
                if subscribers.is_empty() {
                    topics.remove(topic);
                }
            }
        }
    }

    // Emit disconnection event to frontend
    let _ = window.emit("websocket_client_disconnected", &client_id);

    println!("Connection {} closed", client_id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .manage(WebSocketState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Start the overlay HTTP server using Tauri's async runtime
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_overlay_http_server(app_handle).await;
            });
            
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .invoke_handler(tauri::generate_handler![
            start_server,
            get_active_window_title,
            start_websocket_server,
            stop_websocket_server,
            broadcast_websocket_message,
            broadcast_to_topic,
            get_websocket_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
