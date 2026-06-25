import { Feature } from '../feature.svelte';
import { fetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { settings } from '$core/config/settings.svelte';
import { Update } from '.';
import { padEnd } from 'lodash-es';
import { gt } from 'semver';
import Changelog from './changelog.svelte';

export type UpdaterSettings = {
	enabled: boolean;
	didReadChangelog: boolean;
	version: string;
};

/**
 * Checks GitHub for new releases, shows the changelog after updates and
 * writes a settings backup before an update is installed (so "delete all
 * data" during the update never loses the account).
 */
export class Updater extends Feature<UpdaterSettings> {
	name = 'updater';

	hasUpdate = $state<boolean>(false);
	currentVersion = $state<string>('');
	latestVersion = $state<string>('');
	downloadUrl = $state<string | undefined>(undefined);

	get currentVersionFormatted() {
		return padEnd(this.currentVersion.toString(), 6, '.0');
	}

	get latestVersionFormatted() {
		return padEnd(this.latestVersion.toString(), 6, '.0');
	}

	async enable() {
		this.currentVersion = await getVersion();

		void this.#checkForUpdate().then(() => this.#maybeShowChangelog());
	}

	disable() {
		this.hasUpdate = false;
		this.downloadUrl = undefined;
	}

	async #checkForUpdate(): Promise<void> {
		try {
			const response = await fetch('https://api.github.com/repos/fknoobs/app/releases/latest');
			const release = await response.json();

			this.latestVersion = release.tag_name
				? release.tag_name.replace('v', '')
				: this.currentVersion;

			if (gt(this.latestVersion, this.currentVersion)) {
				this.downloadUrl = release.assets?.[0]?.browser_download_url;
				this.hasUpdate = true;

				this.openDialog();
			}
		} catch (error) {
			console.warn('[UPDATER]: update check failed:', error);
			this.latestVersion = this.currentVersion;
		}
	}

	#maybeShowChangelog(): void {
		if (!this.settings.version || gt(this.currentVersion, this.settings.version)) {
			this.openChangelog();

			app.modal.on('close', () => {
				this.settings.version = this.currentVersion;
			});
		}
	}

	/**
	 * Called by the update dialog right before downloading/launching the
	 * installer: snapshots the settings (incl. account) to the external
	 * backup location.
	 */
	async prepareForUpdate(): Promise<void> {
		await settings.flush();
		await settings.backup.backupNow('pre-update');
	}

	openDialog() {
		if (!this.downloadUrl) {
			return;
		}

		app.modal.create({
			component: Update,
			title: 'Update Available',
			description: `
                A new version (${this.latestVersion}) is available. You are currently on version ${this.currentVersion}.<br/><br/>
                Your settings and account are automatically backed up to your Documents folder before updating, so they survive even if you choose to remove all app data during the update.
            `,
			props: {
				currentVersion: this.currentVersion,
				latestVersion: this.latestVersion,
				downloadUrl: this.downloadUrl
			}
		});
		app.modal.open();
	}

	openChangelog() {
		app.modal.create({
			component: Changelog,
			title: 'Changelog',
			description: 'Here are the latest changes in this version:',
			size: 'lg'
		});
		app.modal.open();
	}

	async defaultSettings(): Promise<UpdaterSettings> {
		return {
			enabled: true,
			didReadChangelog: false,
			version: await getVersion()
		};
	}
}

export const updater = new Updater();
