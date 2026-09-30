import { Feature } from '../feature.svelte';
import { getVersion } from '@tauri-apps/api/app';
import { check, Update as TauriUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { app } from '$core/app/context';
import { padEnd } from 'lodash-es';
import { gt } from 'semver';
import Changelog from './changelog.svelte';
import { findLatestWhatsNew, findWhatsNew, normalizeVersion } from './whats-new';
import { settings } from '$core/config/settings.svelte';
import { t } from '$lib/i18n';
import { dev } from '$app/environment';

export type UpdaterSettings = {
	enabled: boolean;
	didReadChangelog: boolean;
	version: string;
};

/**
 * Checks GitHub for signed updates, downloads them in the background,
 * then installs and relaunches as soon as no other modal is open.
 */
export class Updater extends Feature<UpdaterSettings> {
	name = 'updater';

	hasUpdate = $state<boolean>(false);
	currentVersion = $state<string>('');
	latestVersion = $state<string>('');
	pendingUpdate = $state.raw<TauriUpdate | null>(null);
	#stopWaitingForModal: (() => void) | null = null;

	get currentVersionFormatted() {
		return padEnd(this.currentVersion.toString(), 6, '.0');
	}

	get latestVersionFormatted() {
		return padEnd(this.latestVersion.toString(), 6, '.0');
	}

	async enable() {
		this.currentVersion = await getVersion();
		// Await so an open What's New modal is registered before auto-install.
		await this.#maybeShowChangelog();
		if (dev) {
			return;
		}

		void this.#checkForUpdate();
	}

	disable() {
		this.#stopWaitingForModal?.();
		this.hasUpdate = false;
		this.latestVersion = '';
		void this.pendingUpdate?.close();
		this.pendingUpdate = null;
	}

	async #checkForUpdate(): Promise<void> {
		try {
			const update = await check();
			if (!update) {
				this.latestVersion = this.currentVersion;
				return;
			}

			this.pendingUpdate = update;
			this.latestVersion = update.version;
			this.hasUpdate = true;
			app.toast.info(t('Downloading update...'));
			await update.download();
			this.#whenModalIdle(() => {
				void this.#installDownloadedUpdate();
			});
		} catch (error) {
			console.warn('[UPDATER]: update check failed:', error);
			this.latestVersion = this.currentVersion;
			if (this.hasUpdate) {
				app.toast.error(t('Failed to download update.'));
			}

			this.hasUpdate = false;
		}
	}

	async #installDownloadedUpdate(): Promise<void> {
		if (!this.pendingUpdate) {
			return;
		}

		try {
			app.toast.info(t('Installing update...'));
			await this.installAndRelaunch();
		} catch (error) {
			console.warn('[UPDATER]: install failed:', error);
			app.toast.error(t('Failed to install update.'));
		}
	}

	async #maybeShowChangelog(): Promise<void> {
		const current = normalizeVersion(this.currentVersion);
		const previous = normalizeVersion(this.settings.version);

		const shouldShow =
			!previous ||
			(current && previous && gt(current, previous)) ||
			// Fallback: if we can't parse one of the versions, show the changelog
			// when the raw strings differ (better than silently doing nothing).
			(!current || !previous ? this.currentVersion !== this.settings.version : false);

		if (shouldShow) {
			const highlight = await findWhatsNew(previous, current);
			if (highlight) {
				this.openWhatsNew(highlight.markdown);
			} else {
				this.openChangelog();
			}

			void app.modal.once('close').then(() => {
				this.settings.version = current ?? this.currentVersion;
			});
		}
	}

	openWhatsNew(markdown: string) {
		app.modal.create({
			component: Changelog,
			title: t("What's New"),
			description: t('New in this version:'),
			size: 'xl',
			props: { markdown }
		});
		app.modal.open();
	}

	async previewWhatsNew() {
		const highlight = await findLatestWhatsNew();
		if (!highlight) {
			app.toast.info(t("No What's New markdown found."));
			return;
		}

		this.openWhatsNew(highlight.markdown);
	}

	openChangelog() {
		app.modal.create({
			component: Changelog,
			title: t('Changelog'),
			description: t('Here are the latest changes in this version:'),
			size: 'lg'
		});
		app.modal.open();
	}

	/**
	 * Snapshots settings (incl. account) before the installer replaces the app.
	 */
	async prepareForUpdate(): Promise<void> {
		await settings.flush();
		await settings.backup.backupNow('pre-update');
	}

	async installAndRelaunch(): Promise<void> {
		if (!this.pendingUpdate) {
			return;
		}

		await this.prepareForUpdate();
		await this.pendingUpdate.install();
		await relaunch();
	}

	#whenModalIdle(run: () => void): void {
		this.#stopWaitingForModal?.();
		let done = false;
		const finish = () => {
			if (done || app.modal.isOpen) {
				return;
			}

			done = true;
			unsubscribe();
			this.#stopWaitingForModal = null;
			run();
		};
		const unsubscribe = app.modal.on('close', finish);
		this.#stopWaitingForModal = () => {
			done = true;
			unsubscribe();
			this.#stopWaitingForModal = null;
		};
		finish();
	}

	async defaultSettings(): Promise<UpdaterSettings> {
		const version = await getVersion();

		return {
			enabled: true,
			didReadChangelog: false,
			version: normalizeVersion(version) ?? version
		};
	}
}

export const updater = new Updater();
