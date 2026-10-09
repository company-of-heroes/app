import {
	isPermissionGranted,
	requestPermission,
	sendNotification
} from '@tauri-apps/plugin-notification';

let allowed: Promise<boolean> | null = null;

function permission(): Promise<boolean> {
	allowed ??= isPermissionGranted()
		.then(async (granted) => granted || (await requestPermission()) === 'granted')
		.catch(() => false);
	return allowed;
}

/** Markdown bodies as plain text for the Windows toast. */
function plain(markdown: string): string {
	return markdown
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[*_`>#]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 240);
}

/**
 * A Windows notification while the app is not in front (in-game or minimised); in the app the
 * toast and the bell already show it.
 */
export async function notifyOs(title: string, body: string): Promise<void> {
	if (document.hasFocus() || !(await permission())) {
		return;
	}

	try {
		sendNotification({ title, body: plain(body) });
	} catch {
		// Notifications blocked by Windows (focus assist): the bell still has it.
	}
}
