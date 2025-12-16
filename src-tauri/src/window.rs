#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

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

    #[cfg(not(target_os = "windows"))]
    Ok("".to_string())
}
