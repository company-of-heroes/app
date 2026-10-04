import { LogicalSize, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';

/** Logical size of the main window, clamped to the monitor's work area. */
const MAIN_WIDTH = 1600;
const MAIN_HEIGHT = 960;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 600;

/**
 * The window starts as a small frameless splash (see `tauri.conf.json`), like the
 * companion app. Grows it to the main size and centers it; a reload of an already
 * expanded window is a no-op.
 */
export async function expandToMain(): Promise<void> {
	const window = getCurrentWindow();
	try {
		if (await window.isResizable()) {
			return;
		}

		await window.setResizable(true);
		await window.setMaximizable(true);
		await window.setMinSize(new LogicalSize(MIN_WIDTH, MIN_HEIGHT));

		const monitor = await currentMonitor();
		const scale = monitor?.scaleFactor ?? 1;
		const area = monitor?.workArea.size;
		const width = area ? Math.min(MAIN_WIDTH, area.width / scale) : MAIN_WIDTH;
		const height = area ? Math.min(MAIN_HEIGHT, area.height / scale) : MAIN_HEIGHT;
		await window.setSize(new LogicalSize(width, height));
		await window.center();
	} catch (error) {
		console.warn('[window] failed to expand the splash window', error);
	}
}
