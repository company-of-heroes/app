use tauri::Manager;
use window_vibrancy::{apply_acrylic, apply_vibrancy, NSVisualEffectMaterial};

mod migrations;
mod process_check;
mod replay_parser;
mod unzip;
mod webserver;
mod ws_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    let db_url = "sqlite:app.dev.db";

    #[cfg(not(debug_assertions))]
    let db_url = "sqlite:app.db";

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db_url, migrations::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_upload::init())
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
            unzip::unzip_bytes,
            process_check::is_running,
            replay_parser::parse_replay
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
