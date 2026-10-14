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

    #[cfg(target_os = "linux")]
    {
        crate::linux::x11::connection()
            .map(|x11| x11.pressed_modifiers())
            .unwrap_or_default()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
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

/// Runs off the main thread: a long sequence would otherwise freeze the window.
#[command]
pub async fn send_keys(keys: Vec<String>, action: Option<String>) -> Result<(), String> {
    let direction = match action.as_deref() {
        Some("press") => Direction::Press,
        Some("release") => Direction::Release,
        _ => Direction::Click,
    };

    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        if direction == Direction::Click {
            return send_sequence_scancode(&keys);
        }

        #[cfg(target_os = "linux")]
        if direction == Direction::Click && crate::linux::x11::connection().is_some() {
            return send_sequence_xtest(&keys);
        }

        send_action_keys(&keys, direction, true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Hold per key in a sequence; same as chat typing, which DirectInput reads reliably.
#[cfg(any(target_os = "windows", target_os = "linux"))]
const SEQUENCE_KEY_HOLD_US: u64 = 1000;
/// Gap between keys so DirectInput sees each down/up pair (R R R is not one long press).
#[cfg(any(target_os = "windows", target_os = "linux"))]
const SEQUENCE_KEY_GAP_US: u64 = 4000;

/// Types a key sequence (R R R Tab R) as scancodes. Enigo's virtual-key clicks needed
/// 50ms per key and still lost keys in long sequences; DirectInput reads scancodes.
#[cfg(target_os = "windows")]
fn send_sequence_scancode(keys: &[String]) -> Result<(), String> {
    let scans = keys
        .iter()
        .map(|key| key_to_scan(key).ok_or_else(|| format!("Unsupported key: {}", key)))
        .collect::<Result<Vec<_>, _>>()?;

    release_chat_modifiers()?;

    for (index, (vk, extended)) in scans.into_iter().enumerate() {
        if index > 0 {
            precise_sleep(time::Duration::from_micros(SEQUENCE_KEY_GAP_US));
        }

        send_inputs(&[vk_input(vk, true, extended)])?;
        precise_sleep(time::Duration::from_micros(SEQUENCE_KEY_HOLD_US));
        send_inputs(&[vk_input(vk, false, extended)])?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn key_to_scan(key: &str) -> Option<(VIRTUAL_KEY, bool)> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{MapVirtualKeyW, MAPVK_VK_TO_VSC_EX};

    let vk = token_to_vk(key)?;
    // MAPVK_VK_TO_VSC_EX puts 0xE0 in the high byte for extended keys (arrows, Home, …).
    let scan = unsafe { MapVirtualKeyW(vk, MAPVK_VK_TO_VSC_EX) };
    let extended = scan & 0xFF00 == 0xE000 || key.eq_ignore_ascii_case("numpadenter");
    Some((VIRTUAL_KEY(vk as u16), extended))
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

#[cfg(any(target_os = "windows", target_os = "linux"))]
const CHAT_MAX_CHARS: usize = 80;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const CHAT_OPEN_DELAY_MS: u64 = 8;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const CHAT_KEY_HOLD_US: u64 = 1000;
/// A 40-char dump lost the second half; 20 is the largest single poll that survived.
#[cfg(target_os = "windows")]
const CHAT_CHUNK_CHARS: usize = 20;
#[cfg(target_os = "windows")]
const CHAT_CHUNK_DRAIN_MS: u64 = 5;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const CHAT_SEND_DELAY_MS: u64 = 3;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const CHAT_NOT_FOCUSED: &str = "Company of Heroes is not focused";

/// Opens Company of Heroes all-chat (Shift+Enter), types ASCII text, and sends it.
#[command]
pub async fn send_game_chat(message: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = message;
        Err("Game chat is only supported on Windows and Linux".into())
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        tokio::task::spawn_blocking(move || send_game_chat_sync(&message))
            .await
            .map_err(|e| e.to_string())?
    }
}

/// Blocks physical keyboard/mouse for `duration_ms` (default 1000), capped at 2s total.
/// No-op on Linux: an X11 grab would also swallow the XTest keys chat injection sends.
#[command]
pub fn lock_game_input(duration_ms: Option<u64>) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = duration_ms;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        if !is_company_of_heroes_foreground() {
            crate::coh_chat::unlock_user_input();
            return Ok(());
        }
        crate::coh_chat::arm_user_input_lock(time::Duration::from_millis(
            duration_ms.unwrap_or(1000).clamp(1, 2000),
        ));
        Ok(())
    }
}

#[command]
pub fn unlock_game_input() -> Result<(), String> {
    crate::coh_chat::unlock_user_input();
    Ok(())
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn validate_chat_message(message: &str) -> Result<usize, String> {
    let char_count = message.chars().count();
    if char_count == 0 || char_count > CHAT_MAX_CHARS {
        return Err("Chat message must be 1-80 characters".into());
    }
    if !message
        .chars()
        .all(|c| c.is_ascii() && (c.is_ascii_graphic() || c == ' '))
    {
        return Err("Chat message must be ASCII".into());
    }
    Ok(char_count)
}

/// Same flow as Windows (Shift+Enter, US scancodes, Enter) through XTest. Wine reads
/// X key events, so there is no DirectInput burst limit and keys go one at a time.
#[cfg(target_os = "linux")]
fn send_game_chat_sync(message: &str) -> Result<(), String> {
    use crate::linux::keys::{scan_to_keycode, KEYCODE_ENTER, KEYCODE_ESCAPE, KEYCODE_SHIFT_L};

    let char_count = validate_chat_message(message)?;
    let x11 = crate::linux::x11::require()?;
    if !x11.is_coh_foreground() {
        return Err(CHAT_NOT_FOCUSED.into());
    }

    println!("[ANTI-CHEAT] sending all-chat ({} chars)", char_count);

    let hold = time::Duration::from_micros(CHAT_KEY_HOLD_US);
    let click = |keycode: u8| -> Result<(), String> {
        x11.fake_key(keycode, true)?;
        x11.flush()?;
        thread::sleep(hold);
        x11.fake_key(keycode, false)?;
        x11.flush()
    };

    release_chat_modifiers()?;
    x11.fake_key(KEYCODE_SHIFT_L, true)?;
    x11.fake_key(KEYCODE_ENTER, true)?;
    x11.flush()?;
    thread::sleep(hold);
    x11.fake_key(KEYCODE_ENTER, false)?;
    x11.fake_key(KEYCODE_SHIFT_L, false)?;
    x11.flush()?;
    thread::sleep(time::Duration::from_millis(CHAT_OPEN_DELAY_MS));

    if !x11.is_coh_foreground() {
        let _ = click(KEYCODE_ESCAPE);
        return Err(CHAT_NOT_FOCUSED.into());
    }

    let mut shift_down = false;
    for c in message.chars() {
        let (scan, need_shift) = match map_ascii_key(c) {
            Ok(mapped) => mapped,
            Err(error) => {
                let _ = click(KEYCODE_ESCAPE);
                return Err(error);
            }
        };
        if need_shift != shift_down {
            x11.fake_key(KEYCODE_SHIFT_L, need_shift)?;
            shift_down = need_shift;
        }
        click(scan_to_keycode(scan))?;
        thread::sleep(hold);
    }

    if shift_down {
        x11.fake_key(KEYCODE_SHIFT_L, false)?;
    }

    thread::sleep(time::Duration::from_millis(CHAT_SEND_DELAY_MS));
    click(KEYCODE_ENTER)?;

    println!("[ANTI-CHEAT] all-chat sent");
    Ok(())
}

#[cfg(target_os = "linux")]
fn release_chat_modifiers() -> Result<(), String> {
    use crate::linux::keys::{KEYCODE_ALT_L, KEYCODE_CONTROL_L, KEYCODE_SHIFT_L};

    let x11 = crate::linux::x11::require()?;
    for keycode in [KEYCODE_SHIFT_L, KEYCODE_CONTROL_L, KEYCODE_ALT_L] {
        x11.fake_key(keycode, false)?;
    }
    x11.flush()
}

/// Key sequences (R R R Tab R) through XTest with the same hold / gap as the Windows path.
#[cfg(target_os = "linux")]
fn send_sequence_xtest(keys: &[String]) -> Result<(), String> {
    let keycodes = keys
        .iter()
        .map(|key| {
            token_to_vk(key)
                .and_then(crate::linux::keys::vk_to_keycode)
                .ok_or_else(|| format!("Unsupported key: {}", key))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let x11 = crate::linux::x11::require()?;

    release_chat_modifiers()?;

    for (index, keycode) in keycodes.into_iter().enumerate() {
        if index > 0 {
            thread::sleep(time::Duration::from_micros(SEQUENCE_KEY_GAP_US));
        }

        x11.fake_key(keycode, true)?;
        x11.flush()?;
        thread::sleep(time::Duration::from_micros(SEQUENCE_KEY_HOLD_US));
        x11.fake_key(keycode, false)?;
        x11.flush()?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn send_game_chat_sync(message: &str) -> Result<(), String> {
    let char_count = validate_chat_message(message)?;
    if !is_company_of_heroes_foreground() {
        return Err(CHAT_NOT_FOCUSED.into());
    }

    println!("[ANTI-CHEAT] sending all-chat ({} chars)", char_count);

    // Swallow physical keyboard/mouse so Space etc. cannot abort typing.
    // Always released when this returns, and after 1s even if inject hangs.
    let _input_lock = crate::coh_chat::lock_user_input(time::Duration::from_secs(2));
    let _ = release_chat_modifiers();

    // DirectInput ignores UNICODE and Ctrl+V. Dump Stream Deck-sized scancode
    // bursts, then wait one poll — stacking bursts overflows and types slowly.
    if let Err(error) = open_all_chat_scancode() {
        let _ = click_vk(VK_ESCAPE, false);
        return Err(error);
    }

    precise_sleep(time::Duration::from_millis(CHAT_OPEN_DELAY_MS));

    if !is_company_of_heroes_foreground() {
        let _ = click_vk(VK_ESCAPE, false);
        return Err(CHAT_NOT_FOCUSED.into());
    }

    if let Err(error) = type_ascii_and_send(message) {
        let _ = click_vk(VK_ESCAPE, false);
        return Err(error);
    }

    println!("[ANTI-CHEAT] all-chat sent");
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_all_chat_scancode() -> Result<(), String> {
    send_inputs(&[
        vk_input(VK_SHIFT, true, false),
        vk_input(VK_RETURN, true, false),
    ])?;
    precise_sleep(time::Duration::from_micros(CHAT_KEY_HOLD_US));
    send_inputs(&[
        vk_input(VK_RETURN, false, false),
        vk_input(VK_SHIFT, false, false),
    ])?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn release_chat_modifiers() -> Result<(), String> {
    send_inputs(&[
        vk_input(VK_SHIFT, false, false),
        vk_input(VK_CONTROL, false, false),
        vk_input(VK_MENU, false, false),
    ])
}

#[cfg(target_os = "windows")]
fn type_ascii_and_send(message: &str) -> Result<(), String> {
    let chars: Vec<char> = message.chars().collect();
    let Some((first, rest)) = chars.split_first() else {
        return Ok(());
    };

    let mut shift_down = false;
    // First key after Shift+Enter is dropped if it shares a burst; click it
    // on its own so `[FAIRPLAY]` does not become `AIRPLAY]`.
    type_one_char(*first, &mut shift_down)?;
    precise_sleep(time::Duration::from_millis(CHAT_CHUNK_DRAIN_MS));

    let chunks: Vec<&[char]> = rest.chunks(CHAT_CHUNK_CHARS).collect();
    for (index, chunk) in chunks.iter().enumerate() {
        let mut events = Vec::with_capacity(chunk.len() * 4 + 4);
        for c in *chunk {
            append_char_events(*c, &mut shift_down, &mut events)?;
        }
        send_inputs(&events)?;
        if index + 1 < chunks.len() {
            precise_sleep(time::Duration::from_millis(CHAT_CHUNK_DRAIN_MS));
        }
    }

    if shift_down {
        send_inputs(&[vk_input(VK_SHIFT, false, false)])?;
    }

    precise_sleep(time::Duration::from_millis(CHAT_SEND_DELAY_MS));
    send_inputs(&[vk_input(VK_RETURN, true, false)])?;
    precise_sleep(time::Duration::from_micros(CHAT_KEY_HOLD_US));
    send_inputs(&[vk_input(VK_RETURN, false, false)])
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn map_ascii_key(c: char) -> Result<(u16, bool), String> {
    // DirectInput uses US QWERTY scancodes. VkKeyScanW follows the OS layout,
    // so `[` is AltGr+8 on German and types `8` unless we pin US scans.
    let mapped = match c {
        'a'..='z' => Some((us_letter_scan(c), false)),
        'A'..='Z' => Some((us_letter_scan(c.to_ascii_lowercase()), true)),
        '1' => Some((0x02, false)),
        '2' => Some((0x03, false)),
        '3' => Some((0x04, false)),
        '4' => Some((0x05, false)),
        '5' => Some((0x06, false)),
        '6' => Some((0x07, false)),
        '7' => Some((0x08, false)),
        '8' => Some((0x09, false)),
        '9' => Some((0x0A, false)),
        '0' => Some((0x0B, false)),
        ' ' => Some((0x39, false)),
        '-' => Some((0x0C, false)),
        '=' => Some((0x0D, false)),
        '[' => Some((0x1A, false)),
        ']' => Some((0x1B, false)),
        ';' => Some((0x27, false)),
        '\'' => Some((0x28, false)),
        '`' => Some((0x29, false)),
        '\\' => Some((0x2B, false)),
        ',' => Some((0x33, false)),
        '.' => Some((0x34, false)),
        '/' => Some((0x35, false)),
        '!' => Some((0x02, true)),
        '@' => Some((0x03, true)),
        '#' => Some((0x04, true)),
        '$' => Some((0x05, true)),
        '%' => Some((0x06, true)),
        '^' => Some((0x07, true)),
        '&' => Some((0x08, true)),
        '*' => Some((0x09, true)),
        '(' => Some((0x0A, true)),
        ')' => Some((0x0B, true)),
        '_' => Some((0x0C, true)),
        '+' => Some((0x0D, true)),
        '{' => Some((0x1A, true)),
        '}' => Some((0x1B, true)),
        ':' => Some((0x27, true)),
        '"' => Some((0x28, true)),
        '~' => Some((0x29, true)),
        '|' => Some((0x2B, true)),
        '<' => Some((0x33, true)),
        '>' => Some((0x34, true)),
        '?' => Some((0x35, true)),
        _ => None,
    };
    mapped.ok_or_else(|| {
        let _ = release_chat_modifiers();
        format!("Cannot map {c:?} to a US scancode")
    })
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn us_letter_scan(c: char) -> u16 {
    match c {
        'a' => 0x1E,
        'b' => 0x30,
        'c' => 0x2E,
        'd' => 0x20,
        'e' => 0x12,
        'f' => 0x21,
        'g' => 0x22,
        'h' => 0x23,
        'i' => 0x17,
        'j' => 0x24,
        'k' => 0x25,
        'l' => 0x26,
        'm' => 0x32,
        'n' => 0x31,
        'o' => 0x18,
        'p' => 0x19,
        'q' => 0x10,
        'r' => 0x13,
        's' => 0x1F,
        't' => 0x14,
        'u' => 0x16,
        'v' => 0x2F,
        'w' => 0x11,
        'x' => 0x2D,
        'y' => 0x15,
        'z' => 0x2C,
        _ => 0,
    }
}

#[cfg(target_os = "windows")]
fn append_char_events(
    c: char,
    shift_down: &mut bool,
    events: &mut Vec<INPUT>,
) -> Result<(), String> {
    let (scan, need_shift) = map_ascii_key(c)?;
    if need_shift && !*shift_down {
        events.push(vk_input(VK_SHIFT, true, false));
        *shift_down = true;
    } else if !need_shift && *shift_down {
        events.push(vk_input(VK_SHIFT, false, false));
        *shift_down = false;
    }
    events.push(scan_input(scan, true));
    events.push(scan_input(scan, false));
    Ok(())
}

#[cfg(target_os = "windows")]
fn type_one_char(c: char, shift_down: &mut bool) -> Result<(), String> {
    let (scan, need_shift) = map_ascii_key(c)?;
    if need_shift && !*shift_down {
        send_inputs(&[vk_input(VK_SHIFT, true, false)])?;
        *shift_down = true;
        precise_sleep(time::Duration::from_micros(CHAT_KEY_HOLD_US));
    } else if !need_shift && *shift_down {
        send_inputs(&[vk_input(VK_SHIFT, false, false)])?;
        *shift_down = false;
        precise_sleep(time::Duration::from_micros(CHAT_KEY_HOLD_US));
    }
    send_inputs(&[scan_input(scan, true)])?;
    precise_sleep(time::Duration::from_micros(CHAT_KEY_HOLD_US));
    send_inputs(&[scan_input(scan, false)])
}

#[cfg(target_os = "windows")]
fn precise_sleep(duration: time::Duration) {
    let start = time::Instant::now();
    while start.elapsed() < duration {
        std::hint::spin_loop();
    }
}

#[cfg(target_os = "windows")]
fn click_vk(vk: VIRTUAL_KEY, extended: bool) -> Result<(), String> {
    send_inputs(&[vk_input(vk, true, extended), vk_input(vk, false, extended)])
}

#[cfg(target_os = "windows")]
fn vk_input(vk: VIRTUAL_KEY, down: bool, extended: bool) -> INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY,
        KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MAPVK_VK_TO_VSC_EX,
    };

    let mut scan = (unsafe { MapVirtualKeyW(vk.0 as u32, MAPVK_VK_TO_VSC_EX) } as u16) & 0xFF;
    if scan == 0 {
        scan = match vk {
            VK_RETURN => 0x1C,
            VK_ESCAPE => 0x01,
            VK_SHIFT => 0x2A,
            VK_CONTROL => 0x1D,
            VK_MENU => 0x38,
            _ => 0,
        };
    }
    let mut flags = KEYEVENTF_SCANCODE;
    if extended {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }
    if !down {
        flags |= KEYEVENTF_KEYUP;
    }

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
fn scan_input(scan: u16, down: bool) -> INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
        VIRTUAL_KEY,
    };

    let mut flags = KEYEVENTF_SCANCODE;
    if !down {
        flags |= KEYEVENTF_KEYUP;
    }

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0),
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
fn send_inputs(events: &[INPUT]) -> Result<(), String> {
    use std::mem::size_of;
    use windows::Win32::UI::Input::KeyboardAndMouse::SendInput;

    if events.is_empty() {
        return Ok(());
    }
    let sent = unsafe { SendInput(events, size_of::<INPUT>() as i32) };
    if sent as usize != events.len() {
        return Err("SendInput failed".into());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn is_company_of_heroes_foreground() -> bool {
    crate::window::get_active_window_title()
        .map(|title| title.contains("Company Of Heroes"))
        .unwrap_or(false)
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
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, INPUT, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE, VK_MENU, VK_RETURN, VK_SHIFT,
};

#[cfg(target_os = "windows")]
fn is_vk_down(vk: i32) -> bool {
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

enum NumpadKey {
    Digit(u8),
    Multiply,
    Add,
    Subtract,
    Decimal,
    Divide,
}

/// Enigo only has numpad variants on Windows / macOS; on Linux they are X keysyms.
#[cfg(not(target_os = "linux"))]
fn numpad_key(key: NumpadKey) -> Key {
    match key {
        NumpadKey::Digit(0) => Key::Numpad0,
        NumpadKey::Digit(1) => Key::Numpad1,
        NumpadKey::Digit(2) => Key::Numpad2,
        NumpadKey::Digit(3) => Key::Numpad3,
        NumpadKey::Digit(4) => Key::Numpad4,
        NumpadKey::Digit(5) => Key::Numpad5,
        NumpadKey::Digit(6) => Key::Numpad6,
        NumpadKey::Digit(7) => Key::Numpad7,
        NumpadKey::Digit(8) => Key::Numpad8,
        NumpadKey::Digit(_) => Key::Numpad9,
        NumpadKey::Multiply => Key::Multiply,
        NumpadKey::Add => Key::Add,
        NumpadKey::Subtract => Key::Subtract,
        NumpadKey::Decimal => Key::Decimal,
        NumpadKey::Divide => Key::Divide,
    }
}

#[cfg(target_os = "linux")]
fn numpad_key(key: NumpadKey) -> Key {
    Key::Other(match key {
        NumpadKey::Digit(digit) => 0xffb0 + u32::from(digit.min(9)),
        NumpadKey::Multiply => 0xffaa,
        NumpadKey::Add => 0xffab,
        NumpadKey::Subtract => 0xffad,
        NumpadKey::Decimal => 0xffae,
        NumpadKey::Divide => 0xffaf,
    })
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
        "numpad0" | "num0" => Some(numpad_key(NumpadKey::Digit(0))),
        "numpad1" | "num1" => Some(numpad_key(NumpadKey::Digit(1))),
        "numpad2" | "num2" => Some(numpad_key(NumpadKey::Digit(2))),
        "numpad3" | "num3" => Some(numpad_key(NumpadKey::Digit(3))),
        "numpad4" | "num4" => Some(numpad_key(NumpadKey::Digit(4))),
        "numpad5" | "num5" => Some(numpad_key(NumpadKey::Digit(5))),
        "numpad6" | "num6" => Some(numpad_key(NumpadKey::Digit(6))),
        "numpad7" | "num7" => Some(numpad_key(NumpadKey::Digit(7))),
        "numpad8" | "num8" => Some(numpad_key(NumpadKey::Digit(8))),
        "numpad9" | "num9" => Some(numpad_key(NumpadKey::Digit(9))),
        "numpadmultiply" | "nummultiply" => Some(numpad_key(NumpadKey::Multiply)),
        "numpadadd" | "numadd" | "numpadplus" | "numplus" => Some(numpad_key(NumpadKey::Add)),
        "numpadsubtract" | "numsubtract" => Some(numpad_key(NumpadKey::Subtract)),
        "numpaddecimal" | "numdecimal" => Some(numpad_key(NumpadKey::Decimal)),
        "numpaddivide" | "numdivide" => Some(numpad_key(NumpadKey::Divide)),
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
        "printscreen" | "printscr" | "prtscn" | "snapshot" => Some(Key::PrintScr),
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
