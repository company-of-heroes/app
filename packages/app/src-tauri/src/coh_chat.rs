//! Detects Enter / Escape in Company of Heroes for in-game chat without consuming keys.

use std::sync::OnceLock;

use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowTextW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

#[cfg(target_os = "windows")]
static HOOK_HANDLE: Mutex<Option<HHOOK>> = Mutex::new(None);

#[cfg(target_os = "windows")]
const VK_RETURN: u32 = 0x0D;
#[cfg(target_os = "windows")]
const VK_ESCAPE: u32 = 0x1B;

#[cfg(target_os = "windows")]
fn is_company_of_heroes_foreground() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return false;
        }

        let mut text = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut text);
        let title = String::from_utf16_lossy(&text[..len as usize]);

        title.contains("Company Of Heroes")
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 {
        let message = wparam.0 as u32;
        if message == WM_KEYDOWN || message == WM_SYSKEYDOWN {
            let keyboard = &*(lparam.0 as *const KBDLLHOOKSTRUCT);

            if is_company_of_heroes_foreground() {
                if let Some(app) = APP_HANDLE.get() {
                    if keyboard.vkCode == VK_RETURN {
                        let _ = app.emit("game-chat-enter", ());
                    } else if keyboard.vkCode == VK_ESCAPE {
                        let _ = app.emit("game-chat-escape", ());
                    }
                }
            }
        }
    }

    let hook = HOOK_HANDLE
        .lock()
        .ok()
        .and_then(|guard| *guard)
        .unwrap_or_default();

    CallNextHookEx(hook, code, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn run_keyboard_hook_thread() {
    std::thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);

            if let Ok(hook) = hook {
                if let Ok(mut guard) = HOOK_HANDLE.lock() {
                    *guard = Some(hook);
                }

                let mut message = windows::Win32::UI::WindowsAndMessaging::MSG::default();
                while GetMessageW(&mut message, None, 0, 0).into() {
                    let _ = TranslateMessage(&message);
                    let _ = DispatchMessageW(&message);
                }

                let _ = UnhookWindowsHookEx(hook);

                if let Ok(mut guard) = HOOK_HANDLE.lock() {
                    *guard = None;
                }
            }
        }
    });
}

pub fn start_listener(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    #[cfg(target_os = "windows")]
    run_keyboard_hook_thread();
}
