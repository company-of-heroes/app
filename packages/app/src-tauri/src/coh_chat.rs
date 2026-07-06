//! Detects Enter / Escape in Company of Heroes for in-game chat without consuming keys.
//! Also handles hold-to-activate key remaps (e.g. W -> ArrowUp) synchronously.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicIsize, Ordering};

use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowTextW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT,
    LLKHF_INJECTED, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

#[cfg(target_os = "windows")]
static INSTALLED_HOOK: AtomicIsize = AtomicIsize::new(0);

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
    let hook = HHOOK(INSTALLED_HOOK.load(Ordering::Relaxed) as _);

    if code >= 0 {
        let message = wparam.0 as u32;
        let is_key_down = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
        let is_key_up = message == WM_KEYUP || message == WM_SYSKEYUP;

        if is_key_down || is_key_up {
            let keyboard = &*(lparam.0 as *const KBDLLHOOKSTRUCT);

            // Ignore keys we inject ourselves to prevent hook re-entrancy deadlocks.
            if (keyboard.flags.0 & LLKHF_INJECTED.0) != 0 {
                return CallNextHookEx(hook, code, wparam, lparam);
            }

            if is_company_of_heroes_foreground() {
                let is_repeat = is_key_down && (keyboard.flags.0 & (1 << 30)) != 0;

                if crate::hold_bindings::handle_key(keyboard.vkCode, is_key_up, is_repeat) {
                    return LRESULT(1);
                }

                if is_key_down {
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
    }

    CallNextHookEx(hook, code, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn run_keyboard_hook_thread() {
    std::thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);

            if let Ok(hook) = hook {
                INSTALLED_HOOK.store(hook.0 as isize, Ordering::Release);

                let mut message = windows::Win32::UI::WindowsAndMessaging::MSG::default();
                while GetMessageW(&mut message, None, 0, 0).into() {
                    let _ = TranslateMessage(&message);
                    let _ = DispatchMessageW(&message);
                }

                let _ = UnhookWindowsHookEx(hook);
                INSTALLED_HOOK.store(0, Ordering::Release);
            }
        }
    });
}

pub fn start_listener(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    #[cfg(target_os = "windows")]
    run_keyboard_hook_thread();
}
