use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::Manager;
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

mod browser_login;
mod capture;
mod coh_chat;
mod global_shortcuts;
mod hold_bindings;
mod input;
mod migrations;
mod module_check;
mod process_check;
mod replay_parser;
mod steam;
mod tray;
mod unzip;
mod window;
mod ws_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    let db_url = "sqlite:app.dev.db";

    #[cfg(not(debug_assertions))]
    let db_url = "sqlite:app.db";

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db_url, migrations::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_cache::init())
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
            global_shortcuts::reset_global_shortcuts,
            unzip::unzip_file,
            unzip::unzip_bytes,
            unzip::zip_directory,
            process_check::is_running,
            process_check::find_denylisted_processes,
            module_check::find_unknown_game_modules,
            capture::capture_game_window,
            replay_parser::parse_replay,
            input::send_keys,
            input::release_all_held_keys,
            input::shortcut_modifiers_match,
            input::send_game_chat,
            input::lock_game_input,
            input::unlock_game_input,
            hold_bindings::sync_hold_bindings,
            browser_login::complete_browser_login,
            window::get_active_window_title,
            steam::get_steam_install_path
        ])
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-show" => tray::show_main(app),
            "tray-quit" => tray::emit_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray_icon, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                tray::toggle_main(tray_icon.app_handle());
            }
        })
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
                window.close_devtools();
            }

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            let browser_login = browser_login::BrowserLoginState::new();
            app.manage(browser_login.clone());

            ws_server::spawn_ws_server(app.handle().clone(), browser_login);

            coh_chat::start_listener(app.handle());

            tray::attach_menu(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
