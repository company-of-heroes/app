use serde::Serialize;
#[cfg(any(windows, target_os = "linux"))]
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
    // Never report "clean" without having looked.
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        let _ = (process_name, game_root, allowlist);
        return Err("Game module checks are not supported on this platform".into());
    }

    #[cfg(any(windows, target_os = "linux"))]
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
        let steam_roots = benign_steam_roots(steam::get_steam_install_path());
        let game_root = game_root
            .as_deref()
            .map(normalize_root)
            .filter(|path| !path.is_empty());

        for (pid, process) in system.processes() {
            if !process_check::process_matches(process, &process_name) {
                continue;
            }

            let pid_u32 = pid.as_u32();
            let modules = match list_process_modules(pid_u32) {
                Ok(modules) => modules,
                // /proc is always readable for our own user; failing means we checked nothing.
                #[cfg(target_os = "linux")]
                Err(error) => return Err(error),
                #[cfg(windows)]
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
                    &steam_roots,
                    &allowlist,
                ) {
                    continue;
                }

                if unknown.iter().any(|existing: &UnknownGameModule| {
                    existing.path.eq_ignore_ascii_case(&module.path)
                }) {
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

#[cfg(any(windows, target_os = "linux"))]
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
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };

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

/// Files mapped into the Wine process: PE images (`.dll`, `.exe`, `.asi`) and
/// native libraries (`.so`), e.g. an `LD_PRELOAD` injector.
#[cfg(target_os = "linux")]
fn list_process_modules(pid: u32) -> Result<Vec<ProcessModule>, String> {
    let maps = std::fs::read_to_string(format!("/proc/{pid}/maps"))
        .map_err(|error| format!("Reading the modules of pid {pid} failed: {error}"))?;
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for line in maps.lines() {
        // address perms offset dev inode [padding] path (the path may contain spaces)
        let Some(path) = line.splitn(6, ' ').nth(5).map(str::trim) else {
            continue;
        };
        let path = path.trim_end_matches(" (deleted)");
        if !path.starts_with('/') {
            continue;
        }

        let lower = path.to_lowercase();
        let is_module = [".dll", ".exe", ".asi", ".so"]
            .iter()
            .any(|extension| lower.ends_with(extension))
            || lower.contains(".so.");
        if !is_module || !seen.insert(path.to_string()) {
            continue;
        }

        result.push(ProcessModule {
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            path: path.to_string(),
        });
    }

    Ok(result)
}

#[cfg(windows)]
fn is_benign_module(
    path: &str,
    name: &str,
    game_root: Option<&str>,
    steam_roots: &[String],
    allowlist: &[String],
) -> bool {
    let path_lower = path.to_lowercase();

    if is_windows_system_path(&path_lower) {
        return true;
    }

    if let Some(root) = game_root {
        let root_lower = root.to_lowercase();
        if !root_lower.is_empty() && path_lower.starts_with(&root_lower) {
            return true;
        }
    }

    for root in steam_roots {
        let root_lower = root.to_lowercase();
        if !root_lower.is_empty() && path_lower.starts_with(&root_lower) {
            return true;
        }
    }

    // Common GPU / display vendor injectors that show up in almost every game process.
    if is_common_vendor_path(&path_lower) {
        return true;
    }

    is_allowlisted(&path_lower, name, allowlist)
}

/// Proton keeps the game's Wine prefix inside the Steam library, so the Steam
/// root alone is not proof: inside `compatdata` only the prefix's Windows
/// folders count as system files.
#[cfg(target_os = "linux")]
fn is_benign_module(
    path: &str,
    name: &str,
    game_root: Option<&str>,
    steam_roots: &[String],
    allowlist: &[String],
) -> bool {
    let wine_lower = wine_path(path).map(|wine| wine.to_lowercase());

    if let Some(wine_lower) = wine_lower.as_deref() {
        if is_windows_system_path(wine_lower) || is_common_vendor_path(wine_lower) {
            return true;
        }
    }

    if is_allowlisted(&path.to_lowercase(), name, allowlist)
        || wine_lower
            .as_deref()
            .is_some_and(|wine_lower| is_allowlisted(wine_lower, name, allowlist))
    {
        return true;
    }

    if path.contains("/steamapps/compatdata/") {
        return false;
    }

    // Distro, driver and container runtime libraries (Mesa, DXVK, MangoHud, pressure-vessel).
    const SYSTEM_PREFIXES: [&str; 8] = [
        "/usr/",
        "/lib/",
        "/lib32/",
        "/lib64/",
        "/libx32/",
        "/run/host/",
        "/nix/store/",
        "/gnu/store/",
    ];
    if SYSTEM_PREFIXES
        .iter()
        .any(|prefix| path.starts_with(prefix))
    {
        return true;
    }

    let path_lower = path.to_lowercase();
    const RUNTIME_MARKERS: [&str; 4] = [
        "/steamapps/common/proton",
        "/steamapps/common/steamlinuxruntime",
        "/compatibilitytools.d/",
        "/pressure-vessel/",
    ];
    if RUNTIME_MARKERS
        .iter()
        .any(|marker| path_lower.contains(marker))
    {
        return true;
    }

    game_root.is_some_and(|root| path.starts_with(root))
        || steam_roots
            .iter()
            .any(|root| path.starts_with(root.as_str()))
}

#[cfg(any(windows, target_os = "linux"))]
fn is_allowlisted(path_lower: &str, name: &str, allowlist: &[String]) -> bool {
    let name_lower = name.to_lowercase();

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

/// `.../pfx/drive_c/windows/system32/x.dll` -> `C:\windows\system32\x.dll`.
#[cfg(target_os = "linux")]
fn wine_path(path: &str) -> Option<String> {
    let index = path.find("/pfx/drive_c/")?;
    let rest = &path[index + "/pfx/drive_c/".len()..];
    Some(format!("C:\\{}", rest.replace('/', "\\")))
}

#[cfg(any(windows, target_os = "linux"))]
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

#[cfg(any(windows, target_os = "linux"))]
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

/// Steam install(s) whose files count as benign. On Linux `~/.steam/steam` is a
/// symlink, while `/proc/<pid>/maps` shows resolved paths, so roots are canonicalized.
#[cfg(any(windows, target_os = "linux"))]
fn benign_steam_roots(detected: Option<String>) -> Vec<String> {
    #[cfg(target_os = "linux")]
    {
        let mut roots: Vec<String> = crate::steam::linux_steam_roots()
            .into_iter()
            .chain(detected.map(std::path::PathBuf::from))
            .filter_map(|root| std::fs::canonicalize(root).ok())
            .map(|root| normalize_root(&root.to_string_lossy()))
            .collect();
        roots.sort();
        roots.dedup();
        roots
    }

    #[cfg(windows)]
    {
        detected
            .map(|root| normalize_path(&root))
            .filter(|root| !root.is_empty())
            .into_iter()
            .collect()
    }
}

#[cfg(any(windows, target_os = "linux"))]
fn normalize_root(path: &str) -> String {
    #[cfg(target_os = "linux")]
    {
        let trimmed = path.trim().trim_end_matches('/');
        std::fs::canonicalize(trimmed)
            .map(|resolved| resolved.to_string_lossy().into_owned())
            .unwrap_or_else(|_| trimmed.to_string())
    }

    #[cfg(windows)]
    {
        normalize_path(path)
    }
}

#[cfg(any(windows, target_os = "linux"))]
fn normalize_path(path: &str) -> String {
    path.trim().trim_end_matches(['\\', '/']).replace('/', "\\")
}
