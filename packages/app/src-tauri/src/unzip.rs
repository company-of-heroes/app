use std::fs::{self, File};
use std::io::{self, Cursor, Write};
use std::path::{Component, Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, Runtime};
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

const DESTINATION_HEADER: &str = "x-unzip-destination";

/// Reverses JS `encodeURIComponent`.
fn decode_uri_component(value: &str) -> Result<String, String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = value
                .get(i + 1..i + 3)
                .ok_or_else(|| format!("Invalid encoding: {}", value))?;
            let byte =
                u8::from_str_radix(hex, 16).map_err(|_| format!("Invalid encoding: {}", value))?;
            decoded.push(byte);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }

    String::from_utf8(decoded).map_err(|e| e.to_string())
}

/// The zip commands only touch the app's own data and cache folders (overlays live there),
/// so a script in the webview cannot use them to read or write anywhere else on disk.
fn ensure_app_path<R: Runtime>(app: &AppHandle<R>, raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw);
    if !path.is_absolute() || path.components().any(|part| part == Component::ParentDir) {
        return Err(format!("Path not allowed: {}", raw));
    }

    let roots = [app.path().app_data_dir(), app.path().app_cache_dir()];
    let allowed = roots
        .iter()
        .filter_map(|root| root.as_ref().ok())
        .any(|root| path.starts_with(root));
    if !allowed {
        return Err(format!("Path not allowed: {}", raw));
    }

    Ok(path.to_path_buf())
}

#[tauri::command]
pub async fn unzip_file<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    destination: String,
) -> Result<(), String> {
    let destination = ensure_app_path(&app, &destination)?;
    // Open the zip file
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let dest_path = Path::new(&destination);

    // Create destination directory if it doesn't exist
    if !dest_path.exists() {
        fs::create_dir_all(dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file from archive: {}", e))?;

        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            // This is a directory
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // This is a file
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }

            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create output file: {}", e))?;

            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                    .map_err(|e| format!("Failed to set permissions: {}", e))?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn unzip_bytes<R: Runtime>(
    app: AppHandle<R>,
    request: Request<'_>,
) -> Result<(), String> {
    // The zip arrives as the raw IPC body (no JSON number array); the destination
    // travels URI-encoded in a header so non-ASCII profile paths survive.
    let InvokeBody::Raw(zip_data) = request.body() else {
        return Err("Expected the zip as raw bytes".to_string());
    };
    let destination = request
        .headers()
        .get(DESTINATION_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| format!("Missing {} header", DESTINATION_HEADER))
        .and_then(decode_uri_component)?;
    let destination = ensure_app_path(&app, &destination)?;
    let cursor = Cursor::new(zip_data.as_slice());
    let mut archive =
        ZipArchive::new(cursor).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let dest_path = Path::new(&destination);

    // Create destination directory if it doesn't exist
    if !dest_path.exists() {
        fs::create_dir_all(dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file from archive: {}", e))?;

        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            // This is a directory
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // This is a file
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }

            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create output file: {}", e))?;

            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                    .map_err(|e| format!("Failed to set permissions: {}", e))?;
            }
        }
    }

    Ok(())
}

fn add_dir_to_zip<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    base: &Path,
    path: &Path,
    options: FileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let name = entry_path.strip_prefix(base).map_err(|e| e.to_string())?;
        let name_str = name.to_string_lossy().replace('\\', "/");

        if name_str.is_empty() {
            continue;
        }

        if entry_path.is_dir() {
            let dir_name = if name_str.ends_with('/') {
                name_str.clone()
            } else {
                format!("{name_str}/")
            };
            zip.add_directory(dir_name, options)
                .map_err(|e| e.to_string())?;
            add_dir_to_zip(zip, base, &entry_path, options)?;
        } else if name_str == ".publish-state.json" {
            continue;
        } else {
            zip.start_file(name_str, options).map_err(|e| e.to_string())?;
            let mut file = File::open(entry_path).map_err(|e| e.to_string())?;
            io::copy(&mut file, zip).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn zip_directory<R: Runtime>(
    app: AppHandle<R>,
    source: String,
    subdir: Option<String>,
) -> Result<Response, String> {
    let source_path = ensure_app_path(&app, &source)?;
    let zip_root = match subdir.as_deref() {
        Some(name) => ensure_app_path(&app, &source_path.join(name).to_string_lossy())?,
        None => source_path,
    };

    if !zip_root.is_dir() {
        return Err(format!("Source directory not found: {}", zip_root.display()));
    }

    let buffer = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(buffer);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(&mut zip, &zip_root, &zip_root, options)?;
    let buffer = zip.finish().map_err(|e| e.to_string())?;

    // Raw bytes over IPC: an ArrayBuffer in JS instead of a JSON number array.
    Ok(Response::new(buffer.into_inner()))
}
