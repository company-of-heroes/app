use tauri::Manager;
use window_vibrancy::{apply_acrylic, apply_vibrancy, NSVisualEffectMaterial};

mod unzip;
mod webserver;
mod ws_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_cache::init())
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
        .invoke_handler(tauri::generate_handler![
            unzip::unzip_file,
            unzip::unzip_bytes
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                window.open_devtools();
                window.close_devtools();
            }

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_acrylic(&window, Some((0, 0, 0, 0)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");

            // Get the app data directory and create the overlays path
            let app_data_dir = app
                .path()
                .app_data_dir()
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
