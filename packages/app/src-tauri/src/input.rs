use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::{thread, time};
use tauri::command;

#[command]
pub fn send_keys(keys: Vec<String>) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // Release modifiers to prevent them from interfering with the injected keys
    // This is necessary because the user might still be holding the modifier keys
    // that triggered this command (e.g. CTRL+1).
    let modifiers = [Key::Control, Key::Alt, Key::Shift, Key::Meta];
    for key in modifiers {
        // We ignore errors here because we just want to ensure they are up
        let _ = enigo.key(key, Direction::Release);
    }

    for k in keys {
        let key = parse_key(&k).ok_or_else(|| format!("Unsupported key: {}", k))?;
        enigo
            .key(key, Direction::Click)
            .map_err(|e| e.to_string())?;
        thread::sleep(time::Duration::from_millis(50));
    }

    Ok(())
}

fn parse_key(k: &str) -> Option<Key> {
    match k.to_lowercase().as_str() {
        "backspace" => Some(Key::Backspace),
        "tab" => Some(Key::Tab),
        "enter" | "return" => Some(Key::Return),
        "escape" | "esc" => Some(Key::Escape),
        "space" => Some(Key::Space),
        "pageup" => Some(Key::PageUp),
        "pagedown" => Some(Key::PageDown),
        "end" => Some(Key::End),
        "home" => Some(Key::Home),
        "left" | "arrowleft" => Some(Key::LeftArrow),
        "up" | "arrowup" => Some(Key::UpArrow),
        "right" | "arrowright" => Some(Key::RightArrow),
        "down" | "arrowdown" => Some(Key::DownArrow),
        "delete" | "del" => Some(Key::Delete),
        "command" | "meta" | "windows" | "win" => Some(Key::Meta),
        "option" | "alt" => Some(Key::Alt),
        "control" | "ctrl" => Some(Key::Control),
        "shift" => Some(Key::Shift),
        "capslock" => Some(Key::CapsLock),
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),
        c if c.len() == 1 => Some(Key::Unicode(c.chars().next().unwrap())),
        _ => None,
    }
}
