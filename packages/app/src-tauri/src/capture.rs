use serde::Serialize;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::sync::mpsc;
use std::time::{Duration, Instant};

const MAX_WIDTH: u32 = 1920;
const JPEG_QUALITY: u8 = 70;
const MIN_WINDOW_WIDTH: u32 = 400;
const MIN_WINDOW_HEIGHT: u32 = 300;
#[cfg(windows)]
const CAPTURE_TIMEOUT: Duration = Duration::from_secs(4);
const PRINT_SCREEN_WAIT: Duration = Duration::from_secs(6);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameWindowCapture {
    pub jpeg_base64: String,
    pub width: u32,
    pub height: u32,
}

/// Captures Company of Heroes: Print Screen into the game's Screenshots folder
/// (same path as a real / OSK Print Screen), then Windows Graphics Capture.
#[tauri::command]
pub async fn capture_game_window(
    screenshots_dir: Option<String>,
    keep_screenshot: Option<bool>,
) -> Result<GameWindowCapture, String> {
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        let _ = (screenshots_dir, keep_screenshot);
        Err("Game window capture is only supported on Windows and Linux".into())
    }

    #[cfg(any(windows, target_os = "linux"))]
    {
        let keep = keep_screenshot.unwrap_or(false);
        tokio::task::spawn_blocking(move || capture_game_window_sync(screenshots_dir, keep))
            .await
            .map_err(|e| e.to_string())?
    }
}

#[cfg(windows)]
fn capture_game_window_sync(
    screenshots_dir: Option<String>,
    keep_screenshot: bool,
) -> Result<GameWindowCapture, String> {
    let coh_pid = crate::process_check::find_pid("RelicCOH.exe")
        .ok_or_else(|| "Company of Heroes is not running".to_string())?;
    ensure_coh_foreground(coh_pid)?;

    if let Some(dir) = screenshots_dir.filter(|value| !value.trim().is_empty()) {
        if let Ok(rgba) = capture_via_print_screen(&dir, keep_screenshot) {
            if !is_blank_frame(&rgba) {
                return encode_jpeg(rgba);
            }
        }
    }

    let window = pick_coh_window(coh_pid)?;
    let rgba = capture_window_frame(window)?;
    if is_blank_frame(&rgba) {
        return Err("Company of Heroes capture was blank".into());
    }
    ensure_coh_foreground(coh_pid)?;
    encode_jpeg(rgba)
}

/// Linux: the game's own Print Screen shot first (Proton renders through
/// DXVK/Vulkan, which X11 cannot always read back), then an X11 window grab.
#[cfg(target_os = "linux")]
fn capture_game_window_sync(
    screenshots_dir: Option<String>,
    keep_screenshot: bool,
) -> Result<GameWindowCapture, String> {
    let x11 = crate::linux::x11::require()?;
    let coh_pid = crate::process_check::find_pid("RelicCOH.exe")
        .ok_or_else(|| "Company of Heroes is not running".to_string())?;
    let window = x11
        .find_game_window(Some(coh_pid), MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        .ok_or_else(|| "Company of Heroes window not found".to_string())?;
    let is_foreground = || {
        x11.active_window()
            .is_some_and(|active| active == window || x11.window_pid(active) == Some(coh_pid))
            || x11.is_coh_foreground()
    };
    if !is_foreground() {
        return Err("Company of Heroes is not in the foreground".into());
    }

    if let Some(dir) = screenshots_dir.filter(|value| !value.trim().is_empty()) {
        if let Ok(rgba) = capture_via_game_screenshot(&x11, &dir, keep_screenshot) {
            if !is_blank_frame(&rgba) {
                return encode_jpeg(rgba);
            }
        }
    }

    let rgba = x11.capture_window(window)?;
    if is_blank_frame(&rgba) {
        return Err("Company of Heroes capture was blank".into());
    }
    if !is_foreground() {
        return Err("Company of Heroes is not in the foreground".into());
    }
    encode_jpeg(rgba)
}

/// Sends Print Screen to the game (Wine passes it on) and waits for the file it writes.
#[cfg(target_os = "linux")]
fn capture_via_game_screenshot(
    x11: &crate::linux::x11::X11,
    screenshots_dir: &str,
    keep_screenshot: bool,
) -> Result<image::RgbaImage, String> {
    use crate::linux::keys::KEYCODE_PRINT;

    let dir = resolve_screenshots_dir(screenshots_dir);
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let before: std::collections::HashSet<PathBuf> =
        list_screenshot_files(&dir).into_iter().collect();

    x11.fake_key(KEYCODE_PRINT, true)?;
    x11.flush()?;
    std::thread::sleep(Duration::from_millis(30));
    x11.fake_key(KEYCODE_PRINT, false)?;
    x11.flush()?;

    let deadline = Instant::now() + PRINT_SCREEN_WAIT;
    while Instant::now() < deadline {
        if let Some(path) = list_screenshot_files(&dir)
            .into_iter()
            .find(|path| !before.contains(path))
        {
            // The game may still be writing the file.
            std::thread::sleep(Duration::from_millis(150));
            let image = image::open(&path)
                .map_err(|error| error.to_string())?
                .to_rgba8();
            if !keep_screenshot {
                let _ = std::fs::remove_file(&path);
            }
            return Ok(image);
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Err("Company of Heroes did not write a screenshot".into())
}

#[cfg(any(windows, target_os = "linux"))]
fn encode_jpeg(rgba: image::RgbaImage) -> Result<GameWindowCapture, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::codecs::jpeg::JpegEncoder;
    use image::{DynamicImage, ExtendedColorType};

    let mut image = DynamicImage::ImageRgba8(rgba);
    if image.width() > MAX_WIDTH {
        let height = ((image.height() as f32) * (MAX_WIDTH as f32) / (image.width() as f32))
            .round()
            .max(1.0) as u32;
        image = image.resize(MAX_WIDTH, height, image::imageops::FilterType::Triangle);
    }

    let rgb = image.to_rgb8();
    let mut jpeg = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut jpeg, JPEG_QUALITY);
    encoder
        .encode(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            ExtendedColorType::Rgb8,
        )
        .map_err(|error| error.to_string())?;

    Ok(GameWindowCapture {
        jpeg_base64: STANDARD.encode(jpeg),
        width: rgb.width(),
        height: rgb.height(),
    })
}

/// Hardware Print Screen scancodes only. `VK_SNAPSHOT` is what Windows 11 binds
/// to Snipping Tool, so we must not send that virtual key.
#[cfg(windows)]
fn press_print_screen() -> Result<(), String> {
    use std::mem::size_of;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY,
        KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, VIRTUAL_KEY,
    };

    let event = |scan: u16, down: bool| {
        let mut flags = KEYEVENTF_SCANCODE | KEYEVENTF_EXTENDEDKEY;
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
    };
    // AT PrtScn: E0 2A E0 37 / E0 B7 E0 AA
    let events = [
        event(0x2A, true),
        event(0x37, true),
        event(0x37, false),
        event(0x2A, false),
    ];
    let sent = unsafe { SendInput(&events, size_of::<INPUT>() as i32) };
    if sent as usize != events.len() {
        return Err("Print Screen SendInput failed".into());
    }
    Ok(())
}

#[cfg(windows)]
struct SnippingHotkeyGuard {
    previous: Option<u32>,
}

#[cfg(windows)]
impl Drop for SnippingHotkeyGuard {
    fn drop(&mut self) {
        restore_snipping_hotkey(self.previous);
    }
}

#[cfg(windows)]
fn snipping_hotkey_value() -> Option<u32> {
    use windows::core::w;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
        REG_VALUE_TYPE,
    };

    unsafe {
        let mut key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!("Control Panel\\Keyboard"),
            0,
            KEY_READ,
            &mut key,
        )
        .is_err()
        {
            return None;
        }
        let mut data = 0u32;
        let mut size = size_of_u32();
        let mut value_type = REG_VALUE_TYPE::default();
        let status = RegQueryValueExW(
            key,
            w!("PrintScreenKeyForSnippingEnabled"),
            None,
            Some(&mut value_type),
            Some((&mut data as *mut u32).cast()),
            Some(&mut size),
        );
        let _ = RegCloseKey(key);
        if status.is_err() {
            None
        } else {
            Some(data)
        }
    }
}

#[cfg(windows)]
fn size_of_u32() -> u32 {
    std::mem::size_of::<u32>() as u32
}

#[cfg(windows)]
fn set_snipping_hotkey(value: u32) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_DWORD,
    };

    unsafe {
        let mut key = HKEY::default();
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!("Control Panel\\Keyboard"),
            0,
            KEY_SET_VALUE,
            &mut key,
        )
        .map_err(|error| error.to_string())?;
        let bytes = value.to_le_bytes();
        let status = RegSetValueExW(
            key,
            w!("PrintScreenKeyForSnippingEnabled"),
            0,
            REG_DWORD,
            Some(&bytes),
        );
        let _ = RegCloseKey(key);
        status.map_err(|error| error.to_string())?;
    }
    notify_keyboard_setting_changed();
    Ok(())
}

#[cfg(windows)]
fn restore_snipping_hotkey(previous: Option<u32>) {
    if let Some(value) = previous {
        let _ = set_snipping_hotkey(value);
        return;
    }
    use windows::core::w;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
    };
    unsafe {
        let mut key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!("Control Panel\\Keyboard"),
            0,
            KEY_SET_VALUE,
            &mut key,
        )
        .is_ok()
        {
            let _ = RegDeleteValueW(key, w!("PrintScreenKeyForSnippingEnabled"));
            let _ = RegCloseKey(key);
        }
    }
    notify_keyboard_setting_changed();
}

#[cfg(windows)]
fn notify_keyboard_setting_changed() {
    use windows::core::w;
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        SendNotifyMessageW, HWND_BROADCAST, WM_SETTINGCHANGE,
    };

    unsafe {
        let _ = SendNotifyMessageW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            WPARAM(0),
            LPARAM(w!("Control Panel\\Keyboard").as_ptr() as isize),
        );
    }
}

#[cfg(windows)]
fn snipping_pids() -> Vec<u32> {
    use sysinfo::System;

    let mut system = System::new_all();
    system.refresh_processes();
    system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let name = process.name().to_lowercase();
            if name.contains("screenclippinghost") || name.contains("snippingtool") {
                Some(pid.as_u32())
            } else {
                None
            }
        })
        .collect()
}

#[cfg(windows)]
fn close_new_snipping(before: &[u32]) {
    use sysinfo::System;

    let before: std::collections::HashSet<u32> = before.iter().copied().collect();
    let mut system = System::new_all();
    system.refresh_processes();
    for (pid, process) in system.processes() {
        let name = process.name().to_lowercase();
        if !(name.contains("screenclippinghost") || name.contains("snippingtool")) {
            continue;
        }
        if before.contains(&pid.as_u32()) {
            continue;
        }
        let _ = process.kill();
    }
}

#[cfg(any(windows, target_os = "linux"))]
fn resolve_screenshots_dir(preferred: &str) -> PathBuf {
    let path = PathBuf::from(preferred.trim());
    if path.is_dir() {
        return path;
    }
    if let Some(parent) = path.parent() {
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().eq_ignore_ascii_case("screenshots") && entry.path().is_dir()
                {
                    return entry.path();
                }
            }
        }
    }
    path
}

#[cfg(any(windows, target_os = "linux"))]
fn list_screenshot_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| {
                    matches!(
                        ext.to_ascii_lowercase().as_str(),
                        "jpg" | "jpeg" | "bmp" | "png"
                    )
                })
        })
        .collect()
}

#[cfg(windows)]
fn capture_via_print_screen(
    screenshots_dir: &str,
    keep_screenshot: bool,
) -> Result<image::RgbaImage, String> {
    let dir = resolve_screenshots_dir(screenshots_dir);
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let before: std::collections::HashSet<PathBuf> = list_screenshot_files(&dir).into_iter().collect();
    let snipping_before = snipping_pids();
    let previous_hotkey = snipping_hotkey_value();
    let _hotkey_guard = SnippingHotkeyGuard {
        previous: previous_hotkey,
    };
    let _ = set_snipping_hotkey(0);
    press_print_screen()?;
    std::thread::sleep(Duration::from_millis(80));
    let snipping_stole_key = snipping_pids()
        .iter()
        .any(|pid| !snipping_before.contains(pid));
    close_new_snipping(&snipping_before);

    let wait = if snipping_stole_key {
        Duration::from_millis(800)
    } else {
        PRINT_SCREEN_WAIT
    };
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        if let Some(path) = list_screenshot_files(&dir)
            .into_iter()
            .find(|path| !before.contains(path))
        {
            let image = image::open(&path).map_err(|error| error.to_string())?.to_rgba8();
            if !keep_screenshot {
                let _ = std::fs::remove_file(&path);
            }
            return Ok(image);
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Err("Company of Heroes did not write a screenshot".into())
}

#[cfg(windows)]
struct OneFrame {
    tx: Option<mpsc::Sender<Result<image::RgbaImage, String>>>,
}

#[cfg(windows)]
impl windows_capture::capture::GraphicsCaptureApiHandler for OneFrame {
    type Flags = mpsc::Sender<Result<image::RgbaImage, String>>;
    type Error = String;

    fn new(ctx: windows_capture::capture::Context<Self::Flags>) -> Result<Self, Self::Error> {
        Ok(Self {
            tx: Some(ctx.flags),
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut windows_capture::frame::Frame,
        capture_control: windows_capture::graphics_capture_api::InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        let result = frame_to_rgba(frame);
        if let Some(tx) = self.tx.take() {
            let _ = tx.send(result);
        }
        capture_control.stop();
        Ok(())
    }
}

#[cfg(windows)]
fn frame_to_rgba(frame: &mut windows_capture::frame::Frame) -> Result<image::RgbaImage, String> {
    let buffer = frame.buffer().map_err(|error| error.to_string())?;
    let width = buffer.width();
    let height = buffer.height();
    let mut unpacked = Vec::new();
    let pixels = buffer.as_nopadding_buffer(&mut unpacked).to_vec();
    image::RgbaImage::from_raw(width, height, pixels)
        .ok_or_else(|| "Company of Heroes capture buffer was invalid".into())
}

#[cfg(windows)]
fn capture_window_frame(
    window: windows_capture::window::Window,
) -> Result<image::RgbaImage, String> {
    match capture_window_frame_with(window, windows_capture::settings::SecondaryWindowSettings::Exclude)
    {
        Ok(image) => Ok(image),
        Err(error) if error.to_ascii_lowercase().contains("secondary") => {
            capture_window_frame_with(
                window,
                windows_capture::settings::SecondaryWindowSettings::Default,
            )
        }
        Err(error) => Err(error),
    }
}

#[cfg(windows)]
fn capture_window_frame_with(
    window: windows_capture::window::Window,
    secondary: windows_capture::settings::SecondaryWindowSettings,
) -> Result<image::RgbaImage, String> {
    use windows_capture::capture::GraphicsCaptureApiHandler;
    use windows_capture::settings::{
        ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
        MinimumUpdateIntervalSettings, Settings,
    };

    let (tx, rx) = mpsc::channel();
    let settings = Settings::new(
        window,
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::WithoutBorder,
        secondary,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Rgba8,
        tx,
    );
    let control = OneFrame::start_free_threaded(settings).map_err(|error| error.to_string())?;
    match rx.recv_timeout(CAPTURE_TIMEOUT) {
        Ok(result) => {
            let _ = control.stop();
            result
        }
        Err(_) => {
            let _ = control.stop();
            Err("Game window capture timed out".into())
        }
    }
}

#[cfg(windows)]
fn pick_coh_window(coh_pid: u32) -> Result<windows_capture::window::Window, String> {
    use windows_capture::window::Window;

    let windows = Window::enumerate().map_err(|error| error.to_string())?;
    let mut best: Option<(u64, Window)> = None;
    for window in windows {
        if window.process_id().ok() != Some(coh_pid) {
            continue;
        }
        if !window.is_valid() {
            continue;
        }
        let width = window.width().unwrap_or(0).max(0) as u32;
        let height = window.height().unwrap_or(0).max(0) as u32;
        if width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT {
            continue;
        }
        let area = u64::from(width) * u64::from(height);
        if best.as_ref().is_none_or(|(best_area, _)| area > *best_area) {
            best = Some((area, window));
        }
    }

    best.map(|(_, window)| window)
        .ok_or_else(|| "Company of Heroes window not found".to_string())
}

/// GDI/engine blank frames are uniformly black. Real CoH shots still have
/// HUD/minimap variance even when the map itself is dark.
#[cfg(any(windows, target_os = "linux"))]
fn is_blank_frame(image: &image::RgbaImage) -> bool {
    const STEP: usize = 16;
    let mut count = 0u64;
    let mut dark = 0u64;
    let mut sum = 0u64;
    let mut sum_sq = 0u64;

    for (index, pixel) in image.pixels().enumerate() {
        if index % STEP != 0 {
            continue;
        }
        count += 1;
        let luma = u64::from(pixel.0[0]) + u64::from(pixel.0[1]) + u64::from(pixel.0[2]);
        sum += luma;
        sum_sq += luma * luma;
        if luma < 12 {
            dark += 1;
        }
    }

    if count == 0 {
        return true;
    }

    let mean = sum as f64 / count as f64;
    let variance = (sum_sq as f64 / count as f64) - mean * mean;
    dark * 100 / count >= 98 && variance < 80.0
}

#[cfg(windows)]
fn foreground_pid() -> Option<u32> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        (pid != 0).then_some(pid)
    }
}

#[cfg(windows)]
fn ensure_coh_foreground(coh_pid: u32) -> Result<(), String> {
    if foreground_pid() == Some(coh_pid) {
        Ok(())
    } else {
        Err("Company of Heroes is not in the foreground".into())
    }
}
