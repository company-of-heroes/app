use serde::Serialize;
use std::sync::{Arc, Mutex};
use sysinfo::{ProcessRefreshKind, System};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DenylistedProcess {
    pub name: String,
    pub pid: u32,
}

/// One process table for the app's lifetime. A poll only refreshes the process list
/// (names and pids) instead of building a full system snapshot on every call.
#[derive(Clone)]
pub struct ProcessTable(Arc<Mutex<System>>);

impl ProcessTable {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(System::new())))
    }

    fn with_processes<T>(&self, read: impl FnOnce(&System) -> T) -> Result<T, String> {
        let mut system = self.0.lock().map_err(|error| error.to_string())?;
        system.refresh_processes_specifics(ProcessRefreshKind::new());
        Ok(read(&system))
    }
}

pub(crate) fn process_name_matches(proc_name: &str, search_name: &str) -> bool {
    let proc_name = proc_name.to_lowercase();
    let search_name = search_name.to_lowercase();
    let search_name = search_name.trim_end_matches(".exe");

    if search_name.is_empty() {
        return false;
    }

    proc_name == search_name || proc_name == format!("{}.exe", search_name)
}

#[tauri::command]
pub async fn is_running(
    table: State<'_, ProcessTable>,
    process_name: String,
) -> Result<bool, String> {
    let table = table.inner().clone();
    tokio::task::spawn_blocking(move || {
        table.with_processes(|system| {
            system
                .processes()
                .values()
                .any(|process| process_name_matches(process.name(), &process_name))
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn find_denylisted_processes(
    table: State<'_, ProcessTable>,
    names: Vec<String>,
) -> Result<Vec<DenylistedProcess>, String> {
    let table = table.inner().clone();
    tokio::task::spawn_blocking(move || find_denylisted_processes_sync(&table, names))
        .await
        .map_err(|error| error.to_string())?
}

fn find_denylisted_processes_sync(
    table: &ProcessTable,
    names: Vec<String>,
) -> Result<Vec<DenylistedProcess>, String> {
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

    table.with_processes(|system| {
        system
            .processes()
            .iter()
            .filter(|(_pid, process)| {
                searches
                    .iter()
                    .any(|search| process_name_matches(process.name(), search))
            })
            .map(|(pid, process)| DenylistedProcess {
                name: process.name().to_string(),
                pid: pid.as_u32(),
            })
            .collect()
    })
}
