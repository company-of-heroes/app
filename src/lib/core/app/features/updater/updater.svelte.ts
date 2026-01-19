import { Feature } from '../feature.svelte';
import { fetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { Update } from '.';
import { padEnd } from 'lodash-es';
import { gt } from 'semver';
import Changelog from './changelog.svelte';

export type UpdaterSettings = {
	enabled: boolean;
	didReadChangelog: boolean;
	version: string;
};

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

	enable() {
		fetch('https://api.github.com/repos/fknoobs/app/releases/latest')
			.then((res) => res.json())
			.then(async (response) => {
				this.latestVersion = response.tag_name
					? response.tag_name.replace('v', '')
					: await getVersion();
				this.currentVersion = await getVersion();

				if (gt(this.latestVersion, this.currentVersion)) {
					this.downloadUrl = response.assets[0]?.browser_download_url;
					this.hasUpdate = true;

					this.openDialog();
				}
			})
			.then(() => {
				if (gt(this.currentVersion, this.settings.version)) {
					app.modal.create({
						component: Changelog,
						title: 'Changelog',
						description: 'Here are the latest changes in this version:',
						size: 'lg'
					});
					app.modal.open();
					app.modal.on('close', () => {
						this.settings.version = this.currentVersion;
					});
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
			description: `
                A new version (${this.latestVersion}) is available. You are currently on version ${this.currentVersion}.<br/><br/>
                ❗NOTE! When asked, to uninstall, select 'do not uninstall' before installing the new version, as this will delete your settings! Just install the new version over the old one.❗
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

	async defaultSettings() {
		return {
			enabled: true,
			didReadChangelog: false,
			version: await getVersion()
		};
	}
}

export const updater = new Updater();
