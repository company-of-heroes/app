import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from '@company-of-heroes/ui/toasts';
import { dev } from '$app/environment';
import { t } from '$lib/i18n';

async function install(update: Update) {
	const id = toast.loading(t('Downloading update…'));
	try {
		await update.downloadAndInstall();
		await relaunch();
	} catch (error) {
		console.error('[replay-manager] update failed', error);
		toast.error(t('Could not install the update.'), { id });
	}
}

/**
 * Looks for a newer release once on startup (signed `latest.json` on GitHub) and offers it in a
 * toast; nothing installs without a click. Skipped in dev, where there is no installed version.
 */
export async function checkForUpdate(): Promise<void> {
	if (dev) {
		return;
	}

	try {
		const update = await check();
		if (!update) {
			return;
		}

		toast.info(t('Replay Manager {version} is available.', { version: update.version }), {
			duration: Number.POSITIVE_INFINITY,
			action: {
				label: t('Install and restart'),
				onClick: () => void install(update)
			}
		});
	} catch (error) {
		console.warn('[replay-manager] update check failed', error);
	}
}
