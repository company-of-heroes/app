import { Plugin } from '../plugin.svelte';
import { fetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app';
import { Update } from '.';
import { padEnd } from 'lodash-es';

export class Updater extends Plugin {
	name = 'updater';

	hasUpdate = $state<boolean>(false);

	currentVersion = $state<number>(0);

	latestVersion = $state<number>(0);

	downloadUrl = $state<string | undefined>(undefined);

	get currentVersionFormatted() {
		return padEnd(this.currentVersion.toString(), 6, '.0');
	}

	get latestVersionFormatted() {
		return padEnd(this.latestVersion.toString(), 6, '.0');
	}

	enable() {
		fetch('https://api.github.com/repos/fknoobs/app/releases/latest')
			.then((res) => res.json())
			.then(async (response) => {
				this.latestVersion = parseFloat(
					response.tag_name ? response.tag_name.replace('v', '') : await getVersion()
				);
				this.currentVersion = parseFloat(await getVersion());

				if (this.latestVersion > this.currentVersion) {
					this.downloadUrl = response.assets[0]?.browser_download_url;
					this.hasUpdate = true;

					this.openDialog();
				}
			});
	}

	openDialog() {
		if (!this.downloadUrl) {
			return;
		}

		app.modal.create({
			component: Update,
			title: 'Update Available',
			description: `A new version (${this.latestVersion}) is available. You are currently on version ${this.currentVersion}.`,
			props: {
				currentVersion: this.currentVersion,
				latestVersion: this.latestVersion,
				downloadUrl: this.downloadUrl
			}
		});
		app.modal.open();
	}

	defaultSettings() {
		return {
			enabled: true
		};
	}
}

export const updater = new Updater();
