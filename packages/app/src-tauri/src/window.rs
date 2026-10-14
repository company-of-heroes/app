use serde::Serialize;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: &'static str,
    /// Linux: an X server (X11 session or XWayland) is reachable, which the game
    /// input, focus and capture features need.
    pub x11_available: bool,
    pub wayland: bool,
    /// Running from an AppImage, the only Linux format the updater can replace.
    pub app_image: bool,
}

#[tauri::command]
pub fn get_platform_info() -> PlatformInfo {
    #[cfg(target_os = "linux")]
    let x11_available = crate::linux::x11::connection().is_some();
    #[cfg(not(target_os = "linux"))]
    let x11_available = false;

    PlatformInfo {
        os: std::env::consts::OS,
        x11_available,
        wayland: std::env::var_os("WAYLAND_DISPLAY").is_some(),
        app_image: std::env::var_os("APPIMAGE").is_some(),
    }
}

#[tauri::command]
pub fn get_active_window_title() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return Ok("".to_string());
        }

        let mut text: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut text);
        let text = String::from_utf16_lossy(&text[..len as usize]);
        Ok(text)
    }

    #[cfg(target_os = "linux")]
    return Ok(crate::linux::x11::connection()
        .map(|x11| x11.active_window_title())
        .unwrap_or_default());

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    Ok("".to_string())
}
