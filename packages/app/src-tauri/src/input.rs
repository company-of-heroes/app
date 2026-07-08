use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use std::{thread, time};
use tauri::command;

fn keyboard() -> &'static Mutex<Enigo> {
    static KEYBOARD: OnceLock<Mutex<Enigo>> = OnceLock::new();
    KEYBOARD.get_or_init(|| {
        let settings = Settings {
            release_keys_when_dropped: false,
            ..Settings::default()
        };
        Mutex::new(Enigo::new(&settings).expect("Failed to create Enigo"))
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum TriggerModifier {
    Control,
    Shift,
    Alt,
    Super,
}

pub(crate) fn parse_trigger_modifiers(trigger: &str) -> HashSet<TriggerModifier> {
    let mut modifiers = HashSet::new();

    for token in trigger.split('+') {
        match token.trim().to_ascii_uppercase().as_str() {
            "COMMANDORCONTROL" | "COMMANDORCTRL" | "CMDORCTRL" | "CMDORCONTROL" | "CONTROL"
            | "CTRL" | "COMMAND" | "CMD" => {
                modifiers.insert(TriggerModifier::Control);
            }
            "SHIFT" => {
                modifiers.insert(TriggerModifier::Shift);
            }
            "ALT" | "OPTION" => {
                modifiers.insert(TriggerModifier::Alt);
            }
            "SUPER" | "META" | "WIN" | "WINDOWS" => {
                modifiers.insert(TriggerModifier::Super);
            }
            _ => {}
        }
    }

    modifiers
}

pub(crate) fn parse_trigger(trigger: &str) -> Option<(u32, HashSet<TriggerModifier>)> {
    let mut modifiers = HashSet::new();
    let mut trigger_vk = None;

    for token in trigger.split('+') {
        match token.trim().to_ascii_uppercase().as_str() {
            "COMMANDORCONTROL" | "COMMANDORCTRL" | "CMDORCTRL" | "CMDORCONTROL" | "CONTROL"
            | "CTRL" | "COMMAND" | "CMD" => {
                modifiers.insert(TriggerModifier::Control);
            }
            "SHIFT" => {
                modifiers.insert(TriggerModifier::Shift);
            }
            "ALT" | "OPTION" => {
                modifiers.insert(TriggerModifier::Alt);
            }
            "SUPER" | "META" | "WIN" | "WINDOWS" => {
                modifiers.insert(TriggerModifier::Super);
            }
            key => {
                trigger_vk = token_to_vk(key);
            }
        }
    }

    trigger_vk.map(|vk| (vk, modifiers))
}

pub(crate) fn modifiers_match(
    required: &HashSet<TriggerModifier>,
    pressed: &HashSet<TriggerModifier>,
) -> bool {
    if required.is_empty() {
        return pressed.is_empty();
    }

    required.iter().all(|modifier| pressed.contains(modifier))
}

pub(crate) fn pressed_modifiers() -> HashSet<TriggerModifier> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
        };

        let mut pressed = HashSet::new();

        if is_vk_down(VK_SHIFT.0 as i32) {
            pressed.insert(TriggerModifier::Shift);
        }
        if is_vk_down(VK_CONTROL.0 as i32) {
            pressed.insert(TriggerModifier::Control);
        }
        if is_vk_down(VK_MENU.0 as i32) {
            pressed.insert(TriggerModifier::Alt);
        }
        if is_vk_down(VK_LWIN.0 as i32) || is_vk_down(VK_RWIN.0 as i32) {
            pressed.insert(TriggerModifier::Super);
        }

        pressed
    }

    #[cfg(not(target_os = "windows"))]
    {
        HashSet::new()
    }
}

pub(crate) fn send_action_keys(
    keys: &[String],
    direction: Direction,
    release_modifiers: bool,
) -> Result<(), String> {
    let mut enigo = keyboard().lock().map_err(|e| e.to_string())?;

    if release_modifiers && direction != Direction::Release {
        let modifiers = [Key::Control, Key::Alt, Key::Shift, Key::Meta];
        for key in modifiers {
            let _ = enigo.key(key, Direction::Release);
        }
    }

    let keys_to_send: Vec<_> = if direction == Direction::Release {
        keys.iter().rev().collect()
    } else {
        keys.iter().collect()
    };

    for key_name in keys_to_send {
        let key = parse_key(key_name).ok_or_else(|| format!("Unsupported key: {}", key_name))?;
        enigo.key(key, direction).map_err(|e| e.to_string())?;

        if direction == Direction::Click {
            thread::sleep(time::Duration::from_millis(50));
        }
    }

    Ok(())
}

pub(crate) fn release_all_held_internal() -> Result<(), String> {
    let mut enigo = keyboard().lock().map_err(|e| e.to_string())?;
    let (held_keys, _) = enigo.held();

    for key in held_keys {
        let _ = enigo.key(key, Direction::Release);
    }

    Ok(())
}

#[command]
pub fn send_keys(keys: Vec<String>, action: Option<String>) -> Result<(), String> {
    let direction = match action.as_deref() {
        Some("press") => Direction::Press,
        Some("release") => Direction::Release,
        _ => Direction::Click,
    };

    send_action_keys(&keys, direction, true)
}

#[command]
pub fn release_all_held_keys() -> Result<(), String> {
    hold_bindings_clear_active();
    release_all_held_internal()
}

#[command]
pub fn shortcut_modifiers_match(trigger: String) -> Result<bool, String> {
    Ok(modifiers_match_trigger(&trigger))
}

fn modifiers_match_trigger(trigger: &str) -> bool {
    let Some((_, required)) = parse_trigger(trigger) else {
        return false;
    };

    modifiers_match(&required, &pressed_modifiers())
}

fn hold_bindings_clear_active() {
    let _ = crate::hold_bindings::clear_active_holds();
}

#[cfg(target_os = "windows")]
fn is_vk_down(vk: i32) -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    unsafe { GetAsyncKeyState(vk) as u16 & 0x8000 != 0 }
}

fn token_to_vk(token: &str) -> Option<u32> {
    match token.to_ascii_uppercase().as_str() {
        "BACKQUOTE" | "`" => Some(0xC0),
        "BACKSLASH" | "\\" => Some(0xDC),
        "BRACKETLEFT" | "[" => Some(0xDB),
        "BRACKETRIGHT" | "]" => Some(0xDD),
        "COMMA" | "," => Some(0xBC),
        "DIGIT0" | "0" => Some(0x30),
        "DIGIT1" | "1" => Some(0x31),
        "DIGIT2" | "2" => Some(0x32),
        "DIGIT3" | "3" => Some(0x33),
        "DIGIT4" | "4" => Some(0x34),
        "DIGIT5" | "5" => Some(0x35),
        "DIGIT6" | "6" => Some(0x36),
        "DIGIT7" | "7" => Some(0x37),
        "DIGIT8" | "8" => Some(0x38),
        "DIGIT9" | "9" => Some(0x39),
        "EQUAL" | "=" => Some(0xBB),
        "KEYA" | "A" => Some(0x41),
        "KEYB" | "B" => Some(0x42),
        "KEYC" | "C" => Some(0x43),
        "KEYD" | "D" => Some(0x44),
        "KEYE" | "E" => Some(0x45),
        "KEYF" | "F" => Some(0x46),
        "KEYG" | "G" => Some(0x47),
        "KEYH" | "H" => Some(0x48),
        "KEYI" | "I" => Some(0x49),
        "KEYJ" | "J" => Some(0x4A),
        "KEYK" | "K" => Some(0x4B),
        "KEYL" | "L" => Some(0x4C),
        "KEYM" | "M" => Some(0x4D),
        "KEYN" | "N" => Some(0x4E),
        "KEYO" | "O" => Some(0x4F),
        "KEYP" | "P" => Some(0x50),
        "KEYQ" | "Q" => Some(0x51),
        "KEYR" | "R" => Some(0x52),
        "KEYS" | "S" => Some(0x53),
        "KEYT" | "T" => Some(0x54),
        "KEYU" | "U" => Some(0x55),
        "KEYV" | "V" => Some(0x56),
        "KEYW" | "W" => Some(0x57),
        "KEYX" | "X" => Some(0x58),
        "KEYY" | "Y" => Some(0x59),
        "KEYZ" | "Z" => Some(0x5A),
        "MINUS" | "-" => Some(0xBD),
        "PERIOD" | "." => Some(0xBE),
        "QUOTE" | "'" => Some(0xDE),
        "SEMICOLON" | ";" => Some(0xBA),
        "SLASH" | "/" => Some(0xBF),
        "BACKSPACE" => Some(0x08),
        "CAPSLOCK" => Some(0x14),
        "ENTER" => Some(0x0D),
        "SPACE" => Some(0x20),
        "TAB" => Some(0x09),
        "DELETE" => Some(0x2E),
        "END" => Some(0x23),
        "HOME" => Some(0x24),
        "INSERT" => Some(0x2D),
        "PAGEDOWN" => Some(0x22),
        "PAGEUP" => Some(0x21),
        "ARROWDOWN" | "DOWN" => Some(0x28),
        "ARROWLEFT" | "LEFT" => Some(0x25),
        "ARROWRIGHT" | "RIGHT" => Some(0x27),
        "ARROWUP" | "UP" => Some(0x26),
        "NUMPAD0" | "NUM0" => Some(0x60),
        "NUMPAD1" | "NUM1" => Some(0x61),
        "NUMPAD2" | "NUM2" => Some(0x62),
        "NUMPAD3" | "NUM3" => Some(0x63),
        "NUMPAD4" | "NUM4" => Some(0x64),
        "NUMPAD5" | "NUM5" => Some(0x65),
        "NUMPAD6" | "NUM6" => Some(0x66),
        "NUMPAD7" | "NUM7" => Some(0x67),
        "NUMPAD8" | "NUM8" => Some(0x68),
        "NUMPAD9" | "NUM9" => Some(0x69),
        "NUMPADMULTIPLY" | "NUMMULTIPLY" => Some(0x6A),
        "NUMPADADD" | "NUMADD" | "NUMPADPLUS" | "NUMPLUS" => Some(0x6B),
        "NUMPADSUBTRACT" | "NUMSUBTRACT" => Some(0x6D),
        "NUMPADDECIMAL" | "NUMDECIMAL" => Some(0x6E),
        "NUMPADDIVIDE" | "NUMDIVIDE" => Some(0x6F),
        "NUMPADENTER" | "NUMENTER" => Some(0x0D),
        "ESCAPE" | "ESC" => Some(0x1B),
        "F1" => Some(0x70),
        "F2" => Some(0x71),
        "F3" => Some(0x72),
        "F4" => Some(0x73),
        "F5" => Some(0x74),
        "F6" => Some(0x75),
        "F7" => Some(0x76),
        "F8" => Some(0x77),
        "F9" => Some(0x78),
        "F10" => Some(0x79),
        "F11" => Some(0x7A),
        "F12" => Some(0x7B),
        _ => None,
    }
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
        "numpad0" | "num0" => Some(Key::Numpad0),
        "numpad1" | "num1" => Some(Key::Numpad1),
        "numpad2" | "num2" => Some(Key::Numpad2),
        "numpad3" | "num3" => Some(Key::Numpad3),
        "numpad4" | "num4" => Some(Key::Numpad4),
        "numpad5" | "num5" => Some(Key::Numpad5),
        "numpad6" | "num6" => Some(Key::Numpad6),
        "numpad7" | "num7" => Some(Key::Numpad7),
        "numpad8" | "num8" => Some(Key::Numpad8),
        "numpad9" | "num9" => Some(Key::Numpad9),
        "numpadmultiply" | "nummultiply" => Some(Key::Multiply),
        "numpadadd" | "numadd" | "numpadplus" | "numplus" => Some(Key::Add),
        "numpadsubtract" | "numsubtract" => Some(Key::Subtract),
        "numpaddecimal" | "numdecimal" => Some(Key::Decimal),
        "numpaddivide" | "numdivide" => Some(Key::Divide),
        "numpadenter" | "numenter" => Some(Key::Return),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_trigger_modifiers() {
        let modifiers = parse_trigger_modifiers("CommandOrControl+Shift+KeyW");
        assert!(modifiers.contains(&TriggerModifier::Control));
        assert!(modifiers.contains(&TriggerModifier::Shift));
        assert_eq!(parse_trigger_modifiers("KeyW").len(), 0);
    }

    #[test]
    fn parses_trigger_vk() {
        assert_eq!(parse_trigger("KeyW"), Some((0x57, HashSet::new())));
        assert_eq!(
            parse_trigger("CommandOrControl+KeyW"),
            Some((0x57, HashSet::from([TriggerModifier::Control])))
        );
    }

    #[test]
    fn parses_numpad_trigger_and_key() {
        assert_eq!(parse_trigger("Numpad0"), Some((0x60, HashSet::new())));
        assert_eq!(token_to_vk("NumpadAdd"), Some(0x6B));
        assert!(parse_key("numpad0").is_some());
        assert!(parse_key("numpadenter").is_some());
    }
}
