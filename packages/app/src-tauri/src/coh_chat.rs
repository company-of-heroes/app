//! Detects Enter / Escape in Company of Heroes for in-game chat without consuming keys.
//! Also handles hold-to-activate key remaps (e.g. W -> ArrowUp) synchronously.
//! Can briefly swallow physical keyboard/mouse input while fair-play chat is injected.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowTextW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT,
    LLKHF_INJECTED, LLMHF_INJECTED, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN,
    WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static INPUT_LOCK_EPOCH: OnceLock<Instant> = OnceLock::new();
static INPUT_LOCK_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
static INPUT_LOCK_STARTED_MS: AtomicU64 = AtomicU64::new(0);
static INPUT_LOCK_EXHAUSTED: AtomicBool = AtomicBool::new(false);

/// Hard cap: physical input is always restored within this window.
const INPUT_LOCK_MAX_MS: u64 = 2000;

#[cfg(target_os = "windows")]
static INSTALLED_KEYBOARD_HOOK: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static INSTALLED_MOUSE_HOOK: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
const VK_RETURN: u32 = 0x0D;
#[cfg(target_os = "windows")]
const VK_ESCAPE: u32 = 0x1B;

/// Swallows physical keyboard and mouse until dropped, or until `duration` elapses.
pub struct UserInputLock;

impl Drop for UserInputLock {
    fn drop(&mut self) {
        unlock_user_input();
    }
}

pub fn arm_user_input_lock(duration: Duration) {
    if INPUT_LOCK_EXHAUSTED.load(Ordering::Acquire) {
        return;
    }
    let now = now_ms();
    let mut started = INPUT_LOCK_STARTED_MS.load(Ordering::Acquire);
    if started == 0 {
        started = now.max(1);
        INPUT_LOCK_STARTED_MS.store(started, Ordering::Release);
    }
    let cap = started.saturating_add(INPUT_LOCK_MAX_MS);
    if now >= cap {
        expire_user_input_lock();
        return;
    }
    let requested = now.saturating_add(duration.as_millis() as u64).max(1);
    INPUT_LOCK_UNTIL_MS.store(requested.min(cap), Ordering::Release);
}

pub fn lock_user_input(duration: Duration) -> UserInputLock {
    arm_user_input_lock(duration);
    UserInputLock
}

pub fn unlock_user_input() {
    INPUT_LOCK_UNTIL_MS.store(0, Ordering::Release);
    INPUT_LOCK_STARTED_MS.store(0, Ordering::Release);
    INPUT_LOCK_EXHAUSTED.store(false, Ordering::Release);
}

fn expire_user_input_lock() {
    INPUT_LOCK_UNTIL_MS.store(0, Ordering::Release);
    INPUT_LOCK_STARTED_MS.store(0, Ordering::Release);
    INPUT_LOCK_EXHAUSTED.store(true, Ordering::Release);
}

fn now_ms() -> u64 {
    INPUT_LOCK_EPOCH
        .get_or_init(Instant::now)
        .elapsed()
        .as_millis() as u64
}

fn is_user_input_locked() -> bool {
    if INPUT_LOCK_EXHAUSTED.load(Ordering::Acquire) {
        return false;
    }
    let until = INPUT_LOCK_UNTIL_MS.load(Ordering::Acquire);
    if until == 0 {
        return false;
    }
    let now = now_ms();
    let started = INPUT_LOCK_STARTED_MS.load(Ordering::Acquire);
    if started != 0 && now >= started.saturating_add(INPUT_LOCK_MAX_MS) {
        expire_user_input_lock();
        return false;
    }
    if now >= until {
        expire_user_input_lock();
        return false;
    }
    true
}

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
    let hook = HHOOK(INSTALLED_KEYBOARD_HOOK.load(Ordering::Relaxed) as _);

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

            if is_user_input_locked() {
                return LRESULT(1);
            }

            if is_company_of_heroes_foreground() {
                let is_repeat = is_key_down && (keyboard.flags.0 & (1 << 30)) != 0;

                if crate::hold_bindings::handle_key(keyboard.vkCode, is_key_up, is_repeat) {
                    return LRESULT(1);
                }

                if is_key_down && !is_repeat {
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
unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    let hook = HHOOK(INSTALLED_MOUSE_HOOK.load(Ordering::Relaxed) as _);

    if code >= 0 {
        let mouse = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        if (mouse.flags & LLMHF_INJECTED) == 0 && is_user_input_locked() {
            return LRESULT(1);
        }
    }

    CallNextHookEx(hook, code, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn run_input_hook_thread() {
    std::thread::spawn(|| {
        unsafe {
            let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);
            let mouse = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0);

            if let Ok(keyboard) = keyboard {
                INSTALLED_KEYBOARD_HOOK.store(keyboard.0 as isize, Ordering::Release);
            }
            if let Ok(mouse) = mouse {
                INSTALLED_MOUSE_HOOK.store(mouse.0 as isize, Ordering::Release);
            }

            let mut message = windows::Win32::UI::WindowsAndMessaging::MSG::default();
            while GetMessageW(&mut message, None, 0, 0).into() {
                let _ = TranslateMessage(&message);
                let _ = DispatchMessageW(&message);
            }

            let keyboard = HHOOK(INSTALLED_KEYBOARD_HOOK.swap(0, Ordering::AcqRel) as _);
            let mouse = HHOOK(INSTALLED_MOUSE_HOOK.swap(0, Ordering::AcqRel) as _);
            if keyboard.0 != 0 {
                let _ = UnhookWindowsHookEx(keyboard);
            }
            if mouse.0 != 0 {
                let _ = UnhookWindowsHookEx(mouse);
            }
        }
    });
}

pub fn start_listener(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    #[cfg(target_os = "windows")]
    run_input_hook_thread();

    #[cfg(target_os = "linux")]
    if crate::linux::x11::connection().is_some() {
        crate::linux::listener::spawn(app.clone());
    }
}
