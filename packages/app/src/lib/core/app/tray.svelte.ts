import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { exit } from '@tauri-apps/plugin-process';

let started = false;

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
			}
		});

		await listen('tray-quit', async () => {
			try {
				await options.onQuit();
			} catch (error) {
				console.warn('[TRAY]: quit cleanup failed:', error);
			}
			await exit(0);
		});
	} catch (error) {
		console.warn('[TRAY]: failed to start tray handlers:', error);
	}
}
