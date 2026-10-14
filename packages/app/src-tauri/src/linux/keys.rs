//! Windows virtual-key codes <-> Linux evdev key codes. The rest of the app speaks
//! VK codes (triggers, hold bindings); X11 key codes are evdev codes + 8.

/// (Windows VK, evdev code). Letters, digits and punctuation use the PC set-1
/// scancode, which is the same number as the evdev code.
const KEYS: &[(u32, u8)] = &[
    (0x08, 14),  // Backspace
    (0x09, 15),  // Tab
    (0x0D, 28),  // Enter
    (0x10, 42),  // Shift
    (0x11, 29),  // Control
    (0x12, 56),  // Alt
    (0x14, 58),  // CapsLock
    (0x1B, 1),   // Escape
    (0x20, 57),  // Space
    (0x21, 104), // PageUp
    (0x22, 109), // PageDown
    (0x23, 107), // End
    (0x24, 102), // Home
    (0x25, 105), // Left
    (0x26, 103), // Up
    (0x27, 106), // Right
    (0x28, 108), // Down
    (0x2C, 99),  // PrintScreen
    (0x2D, 110), // Insert
    (0x2E, 111), // Delete
    (0x30, 11),
    (0x31, 2),
    (0x32, 3),
    (0x33, 4),
    (0x34, 5),
    (0x35, 6),
    (0x36, 7),
    (0x37, 8),
    (0x38, 9),
    (0x39, 10),
    (0x41, 30),
    (0x42, 48),
    (0x43, 46),
    (0x44, 32),
    (0x45, 18),
    (0x46, 33),
    (0x47, 34),
    (0x48, 35),
    (0x49, 23),
    (0x4A, 36),
    (0x4B, 37),
    (0x4C, 38),
    (0x4D, 50),
    (0x4E, 49),
    (0x4F, 24),
    (0x50, 25),
    (0x51, 16),
    (0x52, 19),
    (0x53, 31),
    (0x54, 20),
    (0x55, 22),
    (0x56, 47),
    (0x57, 17),
    (0x58, 45),
    (0x59, 21),
    (0x5A, 44),
    (0x5B, 125), // Left Super
    (0x60, 82),  // Numpad 0
    (0x61, 79),
    (0x62, 80),
    (0x63, 81),
    (0x64, 75),
    (0x65, 76),
    (0x66, 77),
    (0x67, 71),
    (0x68, 72),
    (0x69, 73),
    (0x6A, 55), // Numpad *
    (0x6B, 78), // Numpad +
    (0x6D, 74), // Numpad -
    (0x6E, 83), // Numpad .
    (0x6F, 98), // Numpad /
    (0x70, 59), // F1
    (0x71, 60),
    (0x72, 61),
    (0x73, 62),
    (0x74, 63),
    (0x75, 64),
    (0x76, 65),
    (0x77, 66),
    (0x78, 67),
    (0x79, 68),
    (0x7A, 87), // F11
    (0x7B, 88), // F12
    (0xBA, 39), // ;
    (0xBB, 13), // =
    (0xBC, 51), // ,
    (0xBD, 12), // -
    (0xBE, 52), // .
    (0xBF, 53), // /
    (0xC0, 41), // `
    (0xDB, 26), // [
    (0xDC, 43), // \
    (0xDD, 27), // ]
    (0xDE, 40), // '
];

/// Extra evdev codes that map onto an existing VK (right-hand modifiers, numpad Enter).
const ALIASES: &[(u8, u32)] = &[
    (54, 0x10),  // Right Shift
    (97, 0x11),  // Right Control
    (100, 0x12), // Right Alt
    (126, 0x5B), // Right Super
    (96, 0x0D),  // Numpad Enter
];

const X11_KEYCODE_OFFSET: u8 = 8;

pub fn vk_to_keycode(vk: u32) -> Option<u8> {
    KEYS.iter()
        .find(|(key, _)| *key == vk)
        .map(|(_, evdev)| evdev + X11_KEYCODE_OFFSET)
}

pub fn keycode_to_vk(keycode: u8) -> Option<u32> {
    let evdev = keycode.checked_sub(X11_KEYCODE_OFFSET)?;
    KEYS.iter()
        .find(|(_, code)| *code == evdev)
        .map(|(vk, _)| *vk)
        .or_else(|| {
            ALIASES
                .iter()
                .find(|(code, _)| *code == evdev)
                .map(|(_, vk)| *vk)
        })
}

/// X11 key code for a PC set-1 scancode (the US-layout chat table in `input.rs`).
pub fn scan_to_keycode(scan: u16) -> u8 {
    (scan as u8).wrapping_add(X11_KEYCODE_OFFSET)
}

pub const KEYCODE_SHIFT_L: u8 = 42 + X11_KEYCODE_OFFSET;
pub const KEYCODE_SHIFT_R: u8 = 54 + X11_KEYCODE_OFFSET;
pub const KEYCODE_CONTROL_L: u8 = 29 + X11_KEYCODE_OFFSET;
pub const KEYCODE_CONTROL_R: u8 = 97 + X11_KEYCODE_OFFSET;
pub const KEYCODE_ALT_L: u8 = 56 + X11_KEYCODE_OFFSET;
pub const KEYCODE_ALT_R: u8 = 100 + X11_KEYCODE_OFFSET;
pub const KEYCODE_SUPER_L: u8 = 125 + X11_KEYCODE_OFFSET;
pub const KEYCODE_SUPER_R: u8 = 126 + X11_KEYCODE_OFFSET;
pub const KEYCODE_ENTER: u8 = 28 + X11_KEYCODE_OFFSET;
pub const KEYCODE_ESCAPE: u8 = 1 + X11_KEYCODE_OFFSET;
pub const KEYCODE_PRINT: u8 = 99 + X11_KEYCODE_OFFSET;
