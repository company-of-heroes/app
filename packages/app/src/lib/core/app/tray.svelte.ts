import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { exit } from '@tauri-apps/plugin-process';
import { settings } from '$core/config/settings.svelte';

let started = false;

/** Never throws: a failed write must not keep the app from closing. */
async function flushSettings(): Promise<void> {
	try {
		await settings.flush();
	} catch (error) {
		console.warn('[TRAY]: settings flush before close failed:', error);
	}
}

export async function startTray(options: {
	shouldCloseToTray: () => boolean;
	onQuit: () => Promise<void>;
}): Promise<void> {
	if (started) {
		return;
	}

	started = true;

	try {
		const window = getCurrentWebviewWindow();

		await window.onCloseRequested(async (event) => {
			if (options.shouldCloseToTray()) {
				event.preventDefault();
				await window.hide();
				return;
			}

			// The window closes after this handler: write a still-debounced settings change first.
			await flushSettings();
		});

		await listen('tray-quit', async () => {
			try {
				await options.onQuit();
			} catch (error) {
				console.warn('[TRAY]: quit cleanup failed:', error);
			}

			await flushSettings();
			await exit(0);
		});
	} catch (error) {
		console.warn('[TRAY]: failed to start tray handlers:', error);
	}
}
