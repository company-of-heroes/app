use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::Path;
use zip::ZipArchive;

#[tauri::command]
pub async fn unzip_file(zip_path: String, destination: String) -> Result<(), String> {
    // Open the zip file
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;
    
    let dest_path = Path::new(&destination);
    
    // Create destination directory if it doesn't exist
    if !dest_path.exists() {
        fs::create_dir_all(dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
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
pub async fn unzip_bytes(zip_data: Vec<u8>, destination: String) -> Result<(), String> {
    let cursor = Cursor::new(zip_data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;
    
    let dest_path = Path::new(&destination);
    
    // Create destination directory if it doesn't exist
    if !dest_path.exists() {
        fs::create_dir_all(dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
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
