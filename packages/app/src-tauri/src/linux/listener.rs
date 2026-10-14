//! X11 counterpart of the Windows low-level hooks in `coh_chat.rs`:
//! - XInput2 raw key events (seen without consuming) emit `game-chat-enter` / `-escape`.
//! - Hold-binding triggers are grabbed with `XGrabKey` only while CoH has focus,
//!   so the trigger key is swallowed like `LRESULT(1)` on Windows. A grabbed key
//!   that no binding handles is replayed to the game. A handled press drops the
//!   grab straight away (an active grab would also capture the action keys we
//!   inject), and the trigger's release is read from XInput2 raw events.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU32, Ordering};

use tauri::{AppHandle, Emitter};
use x11rb::connection::Connection;
use x11rb::protocol::xinput::{self, ConnectionExt as _};
use x11rb::protocol::xkb::{self, ConnectionExt as _};
use x11rb::protocol::xproto::{
    Allow, AtomEnum, ChangeWindowAttributesAux, ClientMessageEvent, ConnectionExt as _,
    CreateWindowAux, EventMask, GrabMode, ModMask, Window, WindowClass,
};
use x11rb::protocol::Event;
use x11rb::rust_connection::RustConnection;

use super::keys;
use crate::input::TriggerModifier;

static WAKE_WINDOW: AtomicU32 = AtomicU32::new(0);

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        if let Err(error) = run(app) {
            eprintln!("[INPUT]: X11 listener stopped: {error}");
        }
    });
}

/// Wakes the listener so it re-reads the hold bindings.
pub fn refresh() {
    let window = WAKE_WINDOW.load(Ordering::Acquire);
    let Some(x11) = super::x11::connection() else {
        return;
    };
    if window == 0 {
        return;
    }

    let event = ClientMessageEvent::new(32, window, AtomEnum::STRING, [0, 0, 0, 0, 0]);
    let _ = x11
        .conn
        .send_event(false, window, EventMask::NO_EVENT, event);
    let _ = x11.flush();
}

/// A grab: key code + exact modifier mask.
type Grab = (u8, u16);

struct Listener {
    conn: RustConnection,
    root: Window,
    wake: Window,
    net_active_window: u32,
    xtest_devices: HashSet<u16>,
    grabs: HashSet<Grab>,
    held: HashSet<u8>,
}

fn run(app: AppHandle) -> Result<(), String> {
    let (conn, screen) = x11rb::connect(None).map_err(|error| error.to_string())?;
    let root = conn.setup().roots[screen].root;
    let net_active_window = super::x11::intern(&conn, "_NET_ACTIVE_WINDOW")?;

    let wake = conn.generate_id().map_err(|error| error.to_string())?;
    conn.create_window(
        0,
        wake,
        root,
        -1,
        -1,
        1,
        1,
        0,
        WindowClass::INPUT_ONLY,
        0,
        &CreateWindowAux::new(),
    )
    .map_err(|error| error.to_string())?;
    conn.change_window_attributes(
        root,
        &ChangeWindowAttributesAux::new().event_mask(EventMask::PROPERTY_CHANGE),
    )
    .map_err(|error| error.to_string())?;

    // Without this a held key repeats as release+press pairs, which would end the grab.
    if conn
        .xkb_use_extension(1, 0)
        .ok()
        .and_then(|cookie| cookie.reply().ok())
        .is_some_and(|reply| reply.supported)
    {
        let _ = conn.xkb_per_client_flags(
            xkb::ID::USE_CORE_KBD.into(),
            xkb::PerClientFlag::DETECTABLE_AUTO_REPEAT,
            xkb::PerClientFlag::DETECTABLE_AUTO_REPEAT,
            xkb::BoolCtrl::from(0u32),
            xkb::BoolCtrl::from(0u32),
            xkb::BoolCtrl::from(0u32),
        );
    }

    let xtest_devices = select_raw_keys(&conn, root)?;
    conn.flush().map_err(|error| error.to_string())?;
    WAKE_WINDOW.store(wake, Ordering::Release);

    let mut listener = Listener {
        conn,
        root,
        wake,
        net_active_window,
        xtest_devices,
        grabs: HashSet::new(),
        held: HashSet::new(),
    };
    listener.update_grabs();

    loop {
        let event = listener
            .conn
            .wait_for_event()
            .map_err(|error| error.to_string())?;

        match event {
            Event::PropertyNotify(event) if event.atom == listener.net_active_window => {
                listener.update_grabs();
            }
            Event::ClientMessage(event) if event.window == listener.wake => {
                listener.update_grabs();
            }
            Event::KeyPress(event) => listener.on_grabbed_press(event.detail, event.time),
            Event::KeyRelease(event) => listener.on_trigger_release(event.detail),
            Event::XinputRawKeyRelease(event) => listener.on_trigger_release(event.detail as u8),
            Event::XinputRawKeyPress(event) => {
                let repeat =
                    u32::from(event.flags) & u32::from(xinput::KeyEventFlags::KEY_REPEAT) != 0;
                if repeat || listener.xtest_devices.contains(&event.sourceid) {
                    continue;
                }
                on_raw_key(&app, event.detail as u8);
            }
            _ => {}
        }
    }
}

/// Selects raw key presses on the root window and returns the XTest device ids,
/// whose events are our own injected keys (like `LLKHF_INJECTED` on Windows).
fn select_raw_keys(conn: &RustConnection, root: Window) -> Result<HashSet<u16>, String> {
    conn.xinput_xi_query_version(2, 0)
        .map_err(|error| error.to_string())?
        .reply()
        .map_err(|error| format!("XInput2 is not available: {error}"))?;

    let mask = xinput::EventMask {
        deviceid: xinput::Device::ALL_MASTER.into(),
        mask: vec![xinput::XIEventMask::RAW_KEY_PRESS | xinput::XIEventMask::RAW_KEY_RELEASE],
    };
    conn.xinput_xi_select_events(root, &[mask])
        .map_err(|error| error.to_string())?;

    let devices = conn
        .xinput_xi_query_device(xinput::Device::ALL)
        .map_err(|error| error.to_string())?
        .reply()
        .map_err(|error| error.to_string())?;

    Ok(devices
        .infos
        .iter()
        .filter(|info| String::from_utf8_lossy(&info.name).contains("XTEST"))
        .map(|info| info.deviceid)
        .collect())
}

fn on_raw_key(app: &AppHandle, keycode: u8) {
    if keycode != keys::KEYCODE_ENTER && keycode != keys::KEYCODE_ESCAPE {
        return;
    }
    if !super::x11::connection().is_some_and(|x11| x11.is_coh_foreground()) {
        return;
    }

    let event = if keycode == keys::KEYCODE_ENTER {
        "game-chat-enter"
    } else {
        "game-chat-escape"
    };
    let _ = app.emit(event, ());
}

fn modifier_mask(modifiers: &HashSet<TriggerModifier>) -> u16 {
    modifiers
        .iter()
        .map(|modifier| match modifier {
            TriggerModifier::Shift => u16::from(ModMask::SHIFT),
            TriggerModifier::Control => u16::from(ModMask::CONTROL),
            TriggerModifier::Alt => u16::from(ModMask::M1),
            TriggerModifier::Super => u16::from(ModMask::M4),
        })
        .fold(0, |mask, bit| mask | bit)
}

impl Listener {
    /// Grabs while CoH is focused, nothing otherwise. Caps Lock / Num Lock variants
    /// are grabbed too, since X matches the modifier mask exactly.
    fn desired_grabs(&self) -> HashSet<Grab> {
        if !super::x11::connection().is_some_and(|x11| x11.is_coh_foreground()) {
            return HashSet::new();
        }

        let locks = [
            0,
            u16::from(ModMask::LOCK),
            u16::from(ModMask::M2),
            u16::from(ModMask::LOCK) | u16::from(ModMask::M2),
        ];
        let mut grabs = HashSet::new();

        for (vk, modifiers) in crate::hold_bindings::trigger_keys() {
            let Some(keycode) = keys::vk_to_keycode(vk) else {
                continue;
            };
            let mask = modifier_mask(&modifiers);
            for lock in locks {
                grabs.insert((keycode, mask | lock));
            }
        }

        grabs
    }

    fn update_grabs(&mut self) {
        let desired = self.desired_grabs();

        for (keycode, mask) in self.grabs.difference(&desired) {
            let _ = self
                .conn
                .ungrab_key(*keycode, self.root, ModMask::from(*mask));
        }
        for (keycode, mask) in desired.difference(&self.grabs) {
            let _ = self.conn.grab_key(
                false,
                self.root,
                ModMask::from(*mask),
                *keycode,
                GrabMode::ASYNC,
                GrabMode::SYNC,
            );
        }

        self.grabs = desired;
        let _ = self.conn.flush();
    }

    fn on_grabbed_press(&mut self, keycode: u8, time: u32) {
        let repeat = !self.held.insert(keycode);
        let handled = keys::keycode_to_vk(keycode)
            .is_some_and(|vk| crate::hold_bindings::handle_key(vk, false, repeat));

        if handled {
            // Swallow the trigger, then end the grab so the injected action keys reach the game.
            let _ = self.conn.allow_events(Allow::ASYNC_KEYBOARD, time);
            let _ = self.conn.ungrab_keyboard(time);
        } else {
            self.held.remove(&keycode);
            let _ = self.conn.allow_events(Allow::REPLAY_KEYBOARD, time);
        }
        let _ = self.conn.flush();
    }

    /// Raw release (or a core release while still grabbed) of a held trigger.
    fn on_trigger_release(&mut self, keycode: u8) {
        if !self.held.remove(&keycode) {
            return;
        }
        if let Some(vk) = keys::keycode_to_vk(keycode) {
            crate::hold_bindings::handle_key(vk, true, false);
        }
    }
}
