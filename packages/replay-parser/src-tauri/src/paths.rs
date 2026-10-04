use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FOLDERS: [&str; 2] = ["Company of Heroes Relaunch", "Company of Heroes"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CohPaths {
    pub playback_dir: Option<String>,
}

/// Playback folder (`My Games\<CoH>\playback`), OneDrive-aware.
/// Mirrors `packages/app/src/lib/core/config/paths.ts`.
#[tauri::command]
pub fn detect_coh_paths(app: tauri::AppHandle) -> CohPaths {
    CohPaths {
        playback_dir: detect_playback_dir(&app).map(|path| path.to_string_lossy().into_owned()),
    }
}

fn detect_playback_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut documents = Vec::new();
    if let Ok(dir) = app.path().document_dir() {
        documents.push(dir);
    }

    if let Ok(home) = app.path().home_dir() {
        documents.push(home.join("OneDrive").join("Documents"));
    }

    let candidates: Vec<PathBuf> = documents
        .iter()
        .flat_map(|documents| {
            CONFIG_FOLDERS
                .iter()
                .map(move |folder| documents.join("My Games").join(folder).join("playback"))
        })
        .collect();

    candidates
        .iter()
        .find(|path| path.is_dir())
        .cloned()
        .or_else(|| candidates.first().cloned())
}
