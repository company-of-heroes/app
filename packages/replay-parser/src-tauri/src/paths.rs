use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FOLDERS: [&str; 2] = ["Company of Heroes Relaunch", "Company of Heroes"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CohPaths {
    pub playback_dir: Option<String>,
}

/// Playback folder (`My Games\<CoH>\playback`), OneDrive-aware; on Linux inside
/// the game's Proton prefix.
/// Mirrors `packages/app/src/lib/core/config/paths.ts`.
#[tauri::command]
pub fn detect_coh_paths(app: tauri::AppHandle) -> CohPaths {
    CohPaths {
        playback_dir: detect_playback_dir(&app).map(|path| path.to_string_lossy().into_owned()),
    }
}

fn detect_playback_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut documents = Vec::new();

    #[cfg(target_os = "linux")]
    if let Ok(home) = app.path().home_dir() {
        documents.extend(proton_documents_dirs(&home));
    }

    #[cfg(not(target_os = "linux"))]
    {
        if let Ok(dir) = app.path().document_dir() {
            documents.push(dir);
        }

        if let Ok(home) = app.path().home_dir() {
            documents.push(home.join("OneDrive").join("Documents"));
        }
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

/// CoH1 Steam app id; Proton keeps the game's Wine prefix under `compatdata/<appid>`.
#[cfg(target_os = "linux")]
const COH_STEAM_APP_ID: &str = "228200";

/// Documents folders of the CoH Proton prefix in every Steam library (native,
/// Flatpak and Snap Steam, plus the libraries in `libraryfolders.vdf`).
#[cfg(target_os = "linux")]
fn proton_documents_dirs(home: &std::path::Path) -> Vec<PathBuf> {
    let mut libraries: Vec<PathBuf> = Vec::new();
    let mut queue: Vec<PathBuf> = [
        ".steam/steam",
        ".steam/root",
        ".local/share/Steam",
        ".var/app/com.valvesoftware.Steam/.local/share/Steam",
        "snap/steam/common/.local/share/Steam",
    ]
    .iter()
    .map(|relative| home.join(relative))
    .collect();

    while let Some(root) = queue.pop() {
        let Ok(resolved) = std::fs::canonicalize(&root) else {
            continue;
        };
        if libraries.contains(&resolved) || !resolved.join("steamapps").is_dir() {
            continue;
        }

        for vdf in ["steamapps/libraryfolders.vdf", "config/libraryfolders.vdf"] {
            let Ok(content) = std::fs::read_to_string(resolved.join(vdf)) else {
                continue;
            };
            queue.extend(library_paths(&content).into_iter().map(PathBuf::from));
        }

        libraries.push(resolved);
    }

    libraries
        .iter()
        .map(|library| {
            library
                .join("steamapps/compatdata")
                .join(COH_STEAM_APP_ID)
                .join("pfx/drive_c/users/steamuser/Documents")
        })
        .filter(|documents| documents.is_dir())
        .collect()
}

/// `"path"  "/mnt/games/SteamLibrary"` entries of a `libraryfolders.vdf`.
#[cfg(target_os = "linux")]
fn library_paths(vdf: &str) -> Vec<String> {
    vdf.lines()
        .filter_map(|line| {
            let mut parts = line.split('"').filter(|part| !part.trim().is_empty());
            (parts.next()? == "path").then(|| parts.next().map(str::to_string))?
        })
        .collect()
}
