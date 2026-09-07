use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DenylistedProcess {
    pub name: String,
    pub pid: u32,
}

pub(crate) fn process_name_matches(proc_name: &str, search_name: &str) -> bool {
    let proc_name = proc_name.to_lowercase();
    let search_name = search_name.to_lowercase();
    let search_name = search_name.trim_end_matches(".exe");

    if search_name.is_empty() {
        return false;
    }

    proc_name == search_name
        || proc_name == format!("{}.exe", search_name)
        || proc_name.starts_with(search_name)
}

#[tauri::command]
pub async fn is_running(process_name: String) -> Result<bool, String> {
    let mut system = System::new_all();
    system.refresh_processes();

    for (_pid, process) in system.processes() {
        if process_name_matches(process.name(), &process_name) {
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn find_denylisted_processes(names: Vec<String>) -> Result<Vec<DenylistedProcess>, String> {
    tokio::task::spawn_blocking(move || find_denylisted_processes_sync(names))
        .await
        .map_err(|error| error.to_string())?
}

fn find_denylisted_processes_sync(names: Vec<String>) -> Result<Vec<DenylistedProcess>, String> {
    if names.is_empty() {
        return Ok(vec![]);
    }

    let searches: Vec<String> = names
        .iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect();

    if searches.is_empty() {
        return Ok(vec![]);
    }

    let mut system = System::new_all();
    system.refresh_processes();

    let mut matches = Vec::new();

    for (pid, process) in system.processes() {
        if searches
            .iter()
            .any(|search| process_name_matches(process.name(), search))
        {
            matches.push(DenylistedProcess {
                name: process.name().to_string(),
                pid: pid.as_u32(),
            });
        }
    }

    Ok(matches)
}
