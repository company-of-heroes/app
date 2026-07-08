//! One-time cleanup of installations from before the app was renamed.
//!
//! The app previously shipped under different product names ("fknoobscoh" and
//! "Company of Heroes - Companion app") and as an NSIS (per-user) installer.
//! Because Tauri derives the install directory and uninstall registry key from
//! the product name, renaming the app leaves those old installs behind, so a
//! user ends up with duplicate "Apps"/Add-Remove-Programs entries.
//!
//! Running this on startup (in the user's own context) lets us silently invoke
//! the old NSIS uninstaller, which removes the stale files and registry entry.

/// Product names used by previous releases. Must NOT include the current name.
#[cfg(target_os = "windows")]
const LEGACY_PRODUCT_NAMES: [&str; 2] = ["fknoobscoh", "Company of Heroes - Companion app"];

/// Removes any leftover installations from earlier, differently-named releases.
///
/// Runs on a background thread so it never delays app startup. Safe to call on
/// every launch: it's a no-op once the old installs are gone.
#[cfg(target_os = "windows")]
pub fn cleanup_legacy_installs() {
    std::thread::spawn(|| {
        for name in LEGACY_PRODUCT_NAMES {
            uninstall_legacy(name);
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn cleanup_legacy_installs() {}

#[cfg(target_os = "windows")]
fn uninstall_legacy(product_name: &str) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    // Old NSIS (currentUser) installs register here.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let sub_key = format!(
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{product_name}"
    );

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(key) = hkcu.open_subkey(&sub_key) else {
        return; // Not installed, nothing to do.
    };

    let uninstall_string: String = key.get_value("UninstallString").unwrap_or_default();
    let uninstaller = uninstall_string.trim().trim_matches('"');
    if uninstaller.is_empty() {
        return;
    }

    // The NSIS uninstaller copies itself to %TEMP% and, running in the user's
    // context, silently removes the install directory and the HKCU uninstall
    // key. Fire-and-forget is enough; the stale entry disappears shortly after.
    let _ = Command::new(uninstaller)
        .arg("/S")
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}
