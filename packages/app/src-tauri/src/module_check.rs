use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnknownGameModule {
    pub name: String,
    pub path: String,
    pub pid: u32,
}

#[tauri::command]
pub async fn find_unknown_game_modules(
    process_name: String,
    game_root: Option<String>,
    allowlist: Vec<String>,
) -> Result<Vec<UnknownGameModule>, String> {
    tokio::task::spawn_blocking(move || {
        find_unknown_game_modules_sync(process_name, game_root, allowlist)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn find_unknown_game_modules_sync(
    process_name: String,
    game_root: Option<String>,
    allowlist: Vec<String>,
) -> Result<Vec<UnknownGameModule>, String> {
    #[cfg(not(windows))]
    {
        let _ = (process_name, game_root, allowlist);
        return Ok(vec![]);
    }

    #[cfg(windows)]
    {
        use crate::process_check;
        use crate::steam;

        let mut system = System::new_all();
        system.refresh_processes();

        let mut unknown = Vec::new();
        let allowlist: Vec<String> = allowlist
            .into_iter()
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
            .collect();
        let steam_root = steam::get_steam_install_path();
        let game_root = game_root
            .as_deref()
            .map(normalize_path)
            .filter(|path| !path.is_empty());

        for (pid, process) in system.processes() {
            if !process_check::process_name_matches(process.name(), &process_name) {
                continue;
            }

            let pid_u32 = pid.as_u32();
            let modules = match list_process_modules(pid_u32) {
                Ok(modules) => modules,
                Err(error) => {
                    eprintln!("[ANTI-CHEAT]: module enumerate failed for pid {pid_u32}: {error}");
                    continue;
                }
            };
            for module in modules {
                if is_benign_module(
                    &module.path,
                    &module.name,
                    game_root.as_deref(),
                    steam_root.as_deref(),
                    &allowlist,
                ) {
                    continue;
                }

                if unknown
                    .iter()
                    .any(|existing: &UnknownGameModule| existing.path.eq_ignore_ascii_case(&module.path))
                {
                    continue;
                }

                unknown.push(UnknownGameModule {
                    name: module.name,
                    path: module.path,
                    pid: pid_u32,
                });
            }
        }

        Ok(unknown)
    }
}

#[cfg(windows)]
struct ProcessModule {
    name: String,
    path: String,
}

#[cfg(windows)]
fn list_process_modules(pid: u32) -> Result<Vec<ProcessModule>, String> {
    use windows::Win32::Foundation::{CloseHandle, HMODULE};
    use windows::Win32::System::ProcessStatus::{
        EnumProcessModulesEx, GetModuleFileNameExW, LIST_MODULES_ALL,
    };
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};

    unsafe {
        let handle = match OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid) {
            Ok(handle) => handle,
            Err(error) => return Err(format!("OpenProcess failed: {error}")),
        };

        let mut modules = [HMODULE::default(); 1024];
        let mut bytes_needed = 0u32;
        if let Err(error) = EnumProcessModulesEx(
            handle,
            modules.as_mut_ptr(),
            (modules.len() * std::mem::size_of::<HMODULE>()) as u32,
            &mut bytes_needed,
            LIST_MODULES_ALL,
        ) {
            let _ = CloseHandle(handle);
            return Err(format!("EnumProcessModulesEx failed: {error}"));
        }

        let count = (bytes_needed as usize / std::mem::size_of::<HMODULE>()).min(modules.len());
        let mut result = Vec::with_capacity(count);

        for module in modules.iter().take(count) {
            let mut buffer = [0u16; 520];
            let length = GetModuleFileNameExW(handle, *module, &mut buffer);
            if length == 0 {
                continue;
            }

            let path = String::from_utf16_lossy(&buffer[..length as usize]);
            let normalized = normalize_path(&path);
            if normalized.is_empty() {
                continue;
            }

            let name = normalized
                .rsplit(['\\', '/'])
                .next()
                .unwrap_or(normalized.as_str())
                .to_string();

            result.push(ProcessModule {
                name,
                path: normalized,
            });
        }

        let _ = CloseHandle(handle);
        Ok(result)
    }
}

#[cfg(windows)]
fn is_benign_module(
    path: &str,
    name: &str,
    game_root: Option<&str>,
    steam_root: Option<&str>,
    allowlist: &[String],
) -> bool {
    let path_lower = path.to_lowercase();
    let name_lower = name.to_lowercase();

    if is_windows_system_path(&path_lower) {
        return true;
    }

    if let Some(root) = game_root {
        let root_lower = root.to_lowercase();
        if !root_lower.is_empty() && path_lower.starts_with(&root_lower) {
            return true;
        }
    }

    if let Some(root) = steam_root {
        let root_lower = normalize_path(root).to_lowercase();
        if !root_lower.is_empty() && path_lower.starts_with(&root_lower) {
            return true;
        }
    }

    // Common GPU / display vendor injectors that show up in almost every game process.
    if is_common_vendor_path(&path_lower) {
        return true;
    }

    for entry in allowlist {
        let entry_lower = entry.to_lowercase();
        let entry_name = entry_lower.trim_end_matches(".dll");
        let module_name = name_lower.trim_end_matches(".dll");

        if module_name == entry_name || name_lower == entry_lower {
            return true;
        }

        let entry_path = normalize_path(entry).to_lowercase();
        if !entry_path.is_empty() && path_lower.starts_with(&entry_path) {
            return true;
        }
    }

    false
}

#[cfg(windows)]
fn is_windows_system_path(path_lower: &str) -> bool {
    let markers = [
        "\\windows\\system32\\",
        "\\windows\\syswow64\\",
        "\\windows\\winsxs\\",
        "\\windows\\systemapps\\",
    ];
    markers.iter().any(|marker| path_lower.contains(marker))
        || path_lower.ends_with("\\windows\\system32")
        || path_lower.ends_with("\\windows\\syswow64")
}

#[cfg(windows)]
fn is_common_vendor_path(path_lower: &str) -> bool {
    let markers = [
        "\\nvidia corporation\\",
        "\\nvidia\\",
        "\\amd\\",
        "\\advanced micro devices\\",
        "\\intel\\",
        "\\intel corporation\\",
        "\\msi\\",
        "\\radeon\\",
        "\\windows defender\\",
        "\\microsoft\\windows defender\\",
    ];
    markers.iter().any(|marker| path_lower.contains(marker))
}

fn normalize_path(path: &str) -> String {
    path.trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
}
