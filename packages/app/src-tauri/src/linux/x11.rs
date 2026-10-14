//! Shared X11 connection plus the window and key helpers the commands use.

use std::collections::HashSet;
use std::sync::{Arc, OnceLock};

use x11rb::connection::Connection;
use x11rb::protocol::xproto::{
    AtomEnum, ConnectionExt as _, ImageFormat, MapState, Window, KEY_PRESS_EVENT, KEY_RELEASE_EVENT,
};
use x11rb::protocol::xtest::ConnectionExt as _;
use x11rb::rust_connection::RustConnection;

use super::keys;
use crate::input::TriggerModifier;

const COH_WINDOW_TITLE: &str = "Company Of Heroes";

pub struct X11 {
    pub conn: RustConnection,
    pub root: Window,
    net_active_window: u32,
    net_client_list: u32,
    net_wm_name: u32,
    net_wm_pid: u32,
    utf8_string: u32,
}

static CONNECTION: OnceLock<Option<Arc<X11>>> = OnceLock::new();

/// The app-wide X11 connection, or `None` without an X server (pure Wayland, no XWayland).
pub fn connection() -> Option<Arc<X11>> {
    CONNECTION
        .get_or_init(|| match X11::connect() {
            Ok(x11) => Some(Arc::new(x11)),
            Err(error) => {
                eprintln!("[X11]: not available: {error}");
                None
            }
        })
        .clone()
}

pub fn require() -> Result<Arc<X11>, String> {
    connection()
        .ok_or_else(|| "X11 is not available (XWayland or an X11 session is required)".into())
}

pub(crate) fn intern(conn: &RustConnection, name: &str) -> Result<u32, String> {
    conn.intern_atom(false, name.as_bytes())
        .map_err(|error| error.to_string())?
        .reply()
        .map(|reply| reply.atom)
        .map_err(|error| error.to_string())
}

impl X11 {
    fn connect() -> Result<Self, String> {
        let (conn, screen) = x11rb::connect(None).map_err(|error| error.to_string())?;
        let root = conn.setup().roots[screen].root;

        Ok(Self {
            net_active_window: intern(&conn, "_NET_ACTIVE_WINDOW")?,
            net_client_list: intern(&conn, "_NET_CLIENT_LIST")?,
            net_wm_name: intern(&conn, "_NET_WM_NAME")?,
            net_wm_pid: intern(&conn, "_NET_WM_PID")?,
            utf8_string: intern(&conn, "UTF8_STRING")?,
            conn,
            root,
        })
    }

    fn property32(&self, window: Window, property: u32, kind: impl Into<u32>) -> Vec<u32> {
        self.conn
            .get_property(false, window, property, kind.into(), 0, 4096)
            .ok()
            .and_then(|cookie| cookie.reply().ok())
            .and_then(|reply| reply.value32().map(|values| values.collect()))
            .unwrap_or_default()
    }

    fn property_text(&self, window: Window, property: u32, kind: impl Into<u32>) -> Option<String> {
        let reply = self
            .conn
            .get_property(false, window, property, kind.into(), 0, 1024)
            .ok()?
            .reply()
            .ok()?;

        (!reply.value.is_empty()).then(|| String::from_utf8_lossy(&reply.value).into_owned())
    }

    /// `_NET_ACTIVE_WINDOW`, or for window managers that do not set it, the
    /// X input focus (walked up to the window that carries a title).
    pub fn active_window(&self) -> Option<Window> {
        let active = self
            .property32(self.root, self.net_active_window, AtomEnum::WINDOW)
            .first()
            .copied()
            .filter(|window| *window != 0);
        if active.is_some() {
            return active;
        }

        let mut window = self.conn.get_input_focus().ok()?.reply().ok()?.focus;
        // 0 = None, 1 = PointerRoot
        for _ in 0..5 {
            if window <= 1 || window == self.root {
                return None;
            }
            if !self.window_title(window).is_empty() {
                return Some(window);
            }
            window = self.conn.query_tree(window).ok()?.reply().ok()?.parent;
        }

        None
    }

    pub fn window_title(&self, window: Window) -> String {
        self.property_text(window, self.net_wm_name, self.utf8_string)
            .or_else(|| self.property_text(window, AtomEnum::WM_NAME.into(), AtomEnum::ANY))
            .unwrap_or_default()
    }

    pub fn window_pid(&self, window: Window) -> Option<u32> {
        self.property32(window, self.net_wm_pid, AtomEnum::CARDINAL)
            .first()
            .copied()
    }

    pub fn active_window_title(&self) -> String {
        self.active_window()
            .map(|window| self.window_title(window))
            .unwrap_or_default()
    }

    pub fn is_coh_foreground(&self) -> bool {
        self.active_window_title().contains(COH_WINDOW_TITLE)
    }

    fn client_windows(&self) -> Vec<Window> {
        let clients = self.property32(self.root, self.net_client_list, AtomEnum::WINDOW);
        if !clients.is_empty() {
            return clients;
        }

        // Without _NET_CLIENT_LIST the root's children are often window-manager
        // frames, so walk a few levels down to reach the client windows.
        let mut windows = Vec::new();
        let mut level = vec![self.root];
        for _ in 0..3 {
            let children: Vec<Window> = level
                .iter()
                .filter_map(|window| self.conn.query_tree(*window).ok()?.reply().ok())
                .flat_map(|reply| reply.children)
                .collect();
            windows.extend(&children);
            level = children;
        }
        windows
    }

    /// The largest visible CoH window: matched on `_NET_WM_PID` (Wine sets it to the
    /// Unix pid), falling back to the window title.
    pub fn find_game_window(
        &self,
        pid: Option<u32>,
        min_width: u32,
        min_height: u32,
    ) -> Option<Window> {
        let mut best: Option<(u64, Window)> = None;

        for window in self.client_windows() {
            let matches_pid = pid.is_some() && self.window_pid(window) == pid;
            if !matches_pid && !self.window_title(window).contains(COH_WINDOW_TITLE) {
                continue;
            }

            let viewable = self
                .conn
                .get_window_attributes(window)
                .ok()
                .and_then(|cookie| cookie.reply().ok())
                .is_some_and(|attributes| attributes.map_state == MapState::VIEWABLE);
            if !viewable {
                continue;
            }

            let Some(geometry) = self
                .conn
                .get_geometry(window)
                .ok()
                .and_then(|cookie| cookie.reply().ok())
            else {
                continue;
            };
            let (width, height) = (u32::from(geometry.width), u32::from(geometry.height));
            if width < min_width || height < min_height {
                continue;
            }

            let area = u64::from(width) * u64::from(height);
            if best.as_ref().is_none_or(|(best_area, _)| area > *best_area) {
                best = Some((area, window));
            }
        }

        best.map(|(_, window)| window)
    }

    /// Queues a key press or release through XTest. Call `flush` to send.
    pub fn fake_key(&self, keycode: u8, down: bool) -> Result<(), String> {
        let kind = if down {
            KEY_PRESS_EVENT
        } else {
            KEY_RELEASE_EVENT
        };
        self.conn
            .xtest_fake_input(kind, keycode, 0, self.root, 0, 0, 0)
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn flush(&self) -> Result<(), String> {
        self.conn.flush().map_err(|error| error.to_string())
    }

    pub fn pressed_keycodes(&self) -> HashSet<u8> {
        let Some(reply) = self
            .conn
            .query_keymap()
            .ok()
            .and_then(|cookie| cookie.reply().ok())
        else {
            return HashSet::new();
        };

        (0u16..256)
            .filter(|code| reply.keys[(*code / 8) as usize] & (1 << (*code % 8)) != 0)
            .map(|code| code as u8)
            .collect()
    }

    pub fn pressed_modifiers(&self) -> HashSet<TriggerModifier> {
        let pressed = self.pressed_keycodes();
        let any = |codes: [u8; 2]| codes.iter().any(|code| pressed.contains(code));
        let mut modifiers = HashSet::new();

        if any([keys::KEYCODE_SHIFT_L, keys::KEYCODE_SHIFT_R]) {
            modifiers.insert(TriggerModifier::Shift);
        }
        if any([keys::KEYCODE_CONTROL_L, keys::KEYCODE_CONTROL_R]) {
            modifiers.insert(TriggerModifier::Control);
        }
        if any([keys::KEYCODE_ALT_L, keys::KEYCODE_ALT_R]) {
            modifiers.insert(TriggerModifier::Alt);
        }
        if any([keys::KEYCODE_SUPER_L, keys::KEYCODE_SUPER_R]) {
            modifiers.insert(TriggerModifier::Super);
        }

        modifiers
    }

    /// Grabs the window contents. Falls back to the matching part of the root
    /// window when the window itself cannot be read (some compositors).
    pub fn capture_window(&self, window: Window) -> Result<image::RgbaImage, String> {
        let geometry = self
            .conn
            .get_geometry(window)
            .map_err(|error| error.to_string())?
            .reply()
            .map_err(|error| error.to_string())?;
        let (width, height) = (geometry.width, geometry.height);

        let direct = self
            .conn
            .get_image(ImageFormat::Z_PIXMAP, window, 0, 0, width, height, !0)
            .ok()
            .and_then(|cookie| cookie.reply().ok());
        let reply = match direct {
            Some(reply) => reply,
            None => {
                let origin = self
                    .conn
                    .translate_coordinates(window, self.root, 0, 0)
                    .map_err(|error| error.to_string())?
                    .reply()
                    .map_err(|error| error.to_string())?;
                self.conn
                    .get_image(
                        ImageFormat::Z_PIXMAP,
                        self.root,
                        origin.dst_x,
                        origin.dst_y,
                        width,
                        height,
                        !0,
                    )
                    .map_err(|error| error.to_string())?
                    .reply()
                    .map_err(|error| error.to_string())?
            }
        };

        let pixels = usize::from(width) * usize::from(height);
        if reply.depth < 24 || reply.data.len() < pixels * 4 {
            return Err(format!(
                "Unsupported X11 image format (depth {})",
                reply.depth
            ));
        }

        // 24/32-bit ZPixmap is BGRX in memory on little-endian servers.
        let mut rgba = Vec::with_capacity(pixels * 4);
        for pixel in reply.data.chunks_exact(4).take(pixels) {
            rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], 255]);
        }

        image::RgbaImage::from_raw(u32::from(width), u32::from(height), rgba)
            .ok_or_else(|| "Company of Heroes capture buffer was invalid".into())
    }
}
