#[cfg(windows)]
use windows::core::w;
#[cfg(windows)]
use windows::Win32::System::Registry::{
    RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
    KEY_READ, REG_VALUE_TYPE,
};

#[tauri::command]
pub fn get_steam_install_path() -> Option<String> {
    #[cfg(windows)]
    {
        query_steam_path(
            HKEY_CURRENT_USER,
            w!("Software\\Valve\\Steam"),
            w!("SteamPath"),
        )
        .or_else(|| {
            query_steam_path(
                HKEY_LOCAL_MACHINE,
                w!("SOFTWARE\\WOW6432Node\\Valve\\Steam"),
                w!("InstallPath"),
            )
        })
        .or_else(|| {
            query_steam_path(
                HKEY_LOCAL_MACHINE,
                w!("SOFTWARE\\Valve\\Steam"),
                w!("InstallPath"),
            )
        })
    }

    #[cfg(target_os = "linux")]
    return linux_steam_roots()
        .into_iter()
        .find(|root| root.join("steamapps").is_dir())
        .map(|root| root.to_string_lossy().into_owned());

    #[cfg(not(any(windows, target_os = "linux")))]
    None
}

/// Native, Flatpak and Snap Steam installs.
#[cfg(target_os = "linux")]
pub fn linux_steam_roots() -> Vec<std::path::PathBuf> {
    let Some(home) = std::env::var_os("HOME").map(std::path::PathBuf::from) else {
        return Vec::new();
    };

    [
        ".steam/steam",
        ".steam/root",
        ".local/share/Steam",
        ".var/app/com.valvesoftware.Steam/.local/share/Steam",
        "snap/steam/common/.local/share/Steam",
    ]
    .iter()
    .map(|relative| home.join(relative))
    .collect()
}

#[cfg(windows)]
fn query_steam_path(
    hive: HKEY,
    subkey: windows::core::PCWSTR,
    value: windows::core::PCWSTR,
) -> Option<String> {
    unsafe {
        let mut key = HKEY::default();
        if RegOpenKeyExW(hive, subkey, 0, KEY_READ, &mut key).is_err() {
            return None;
        }

        let mut buf = [0u16; 520];
        let mut size = (buf.len() * 2) as u32;
        let mut value_type = REG_VALUE_TYPE::default();
        let status = RegQueryValueExW(
            key,
            value,
            None,
            Some(&mut value_type),
            Some(buf.as_mut_ptr().cast()),
            Some(&mut size),
        );
        let _ = RegCloseKey(key);

        if status.is_err() {
            return None;
        }

        let chars = (size as usize / 2).min(buf.len());
        let path = String::from_utf16_lossy(&buf[..chars])
            .trim_end_matches('\0')
            .trim()
            .replace('/', "\\");

        if path.is_empty() {
            None
        } else {
            Some(path)
        }
    }
}
