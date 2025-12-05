use sysinfo::System;

#[tauri::command]
pub async fn is_running(process_name: String) -> Result<bool, String> {
    let mut system = System::new_all();
    system.refresh_processes();

    // Check if any process matches the given name
    for (_pid, process) in system.processes() {
        let proc_name = process.name().to_lowercase();
        let search_name = process_name.to_lowercase();
        
        // Check for exact match or match with .exe extension
        if proc_name == search_name || 
           proc_name == format!("{}.exe", search_name) ||
           proc_name.starts_with(&search_name) {
            return Ok(true);
        }
    }

    Ok(false)
}
