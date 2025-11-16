use tauri::Manager;

mod webserver;
mod ws_server;
mod unzip;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        // Keep only plugin initializations (all custom commands & state removed per user request)
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .invoke_handler(tauri::generate_handler![unzip::unzip_file, unzip::unzip_bytes])
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }

            // Get the app data directory and create the overlays path
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            let overlays_path = app_data_dir.join("overlays");

            // Create the overlays directory if it doesn't exist
            if !overlays_path.exists() {
                std::fs::create_dir_all(&overlays_path)
                    .expect("Failed to create overlays directory");
            }

            // Start the web server
            webserver::spawn_server(overlays_path);

            // Start the WebSocket server
            ws_server::spawn_ws_server();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
