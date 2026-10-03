import {
	PhysicalPosition,
	PhysicalSize,
	availableMonitors,
	currentMonitor,
	type Monitor
} from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { settings } from '$core/config/settings.svelte';
import type { WindowBounds } from '$core/config/schema';

/** Logical size of the main window when no previous bounds are known. */
const DEFAULT_WIDTH = 1800;
const DEFAULT_HEIGHT = 1000;

const SAVE_DEBOUNCE_MS = 500;

let expanding: Promise<void> | null = null;

/**
 * The main window starts as a small frameless splash (see `tauri.conf.json`).
 * Grows it to the last known bounds (or a centered default) and starts
 * tracking moves/resizes. Idempotent: later calls are no-ops.
 */
export const expandToMain = (): Promise<void> => {
	expanding ??= expand().catch((error) => {
		console.warn('[WINDOW]: failed to restore window bounds:', error);
	});
	return expanding;
};

const overlaps = (bounds: WindowBounds, monitor: Monitor): boolean => {
	const { position, size } = monitor.workArea;
	return (
		bounds.x < position.x + size.width &&
		bounds.x + bounds.width > position.x &&
		bounds.y < position.y + size.height &&
		bounds.y + bounds.height > position.y
	);
};

async function expand(): Promise<void> {
	const window = getCurrentWebviewWindow();
	// Reload (Ctrl+R) on an already expanded window: only resume tracking.
	if (await window.isResizable()) {
		await track();
		return;
	}

	await window.setDecorations(true);
	await window.setResizable(true);
	await window.setMaximizable(true);

	const saved = settings.tree.app.window ?? null;
	const monitors = await availableMonitors();
	if (saved && saved.width > 0 && saved.height > 0 && monitors.some((m) => overlaps(saved, m))) {
		await window.setSize(new PhysicalSize(saved.width, saved.height));
		await window.setPosition(new PhysicalPosition(saved.x, saved.y));
		if (saved.maximized) {
			await window.maximize();
		}
	} else {
		const monitor = await currentMonitor();
		let width = Math.round(DEFAULT_WIDTH * (monitor?.scaleFactor ?? 1));
		let height = Math.round(DEFAULT_HEIGHT * (monitor?.scaleFactor ?? 1));
		if (monitor) {
			width = Math.min(width, monitor.workArea.size.width);
			height = Math.min(height, monitor.workArea.size.height);
		}

		await window.setSize(new PhysicalSize(width, height));
		await window.center();
	}

	await track();
}

async function track(): Promise<void> {
	const window = getCurrentWebviewWindow();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const save = async () => {
		try {
			if (await window.isMinimized()) {
				return;
			}

			const maximized = await window.isMaximized();
			const current = settings.tree.app.window ?? null;
			// Keep the restore rect while maximized; only remember the flag.
			if (maximized) {
				if (current && !current.maximized) {
					settings.tree.app.window = { ...current, maximized: true };
				}

				return;
			}

			const position = await window.outerPosition();
			const size = await window.outerSize();
			if (size.width <= 0 || size.height <= 0) {
				return;
			}

			settings.tree.app.window = {
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				maximized: false
			};
		} catch (error) {
			console.warn('[WINDOW]: failed to save window bounds:', error);
		}
	};

	const schedule = () => {
		if (timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
	};

	await window.onMoved(schedule);
	await window.onResized(schedule);
	await save();
}
