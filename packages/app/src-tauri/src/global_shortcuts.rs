use tauri::AppHandle;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Clears every global shortcut tracked by this app (used before re-registering hotkeys).
#[tauri::command]
pub fn reset_global_shortcuts(app: AppHandle) -> Result<(), String> {
	app.global_shortcut()
		.unregister_all()
		.map_err(|error| error.to_string())
}
