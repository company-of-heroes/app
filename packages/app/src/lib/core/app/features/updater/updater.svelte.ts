import { Feature } from '../feature.svelte';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { padEnd } from 'lodash-es';
import { gt } from 'semver';
import Changelog from './changelog.svelte';

export type UpdaterSettings = {
	enabled: boolean;
	didReadChangelog: boolean;
	version: string;
};

/**
 * Surfaces the current app version and shows the changelog after an update.
 *
 * Updates themselves are handled outside the app (Microsoft Store), so this
 * feature no longer checks for or downloads new versions.
 */
export class Updater extends Feature<UpdaterSettings> {
	name = 'updater';

	currentVersion = $state<string>('');

	get currentVersionFormatted() {
		return padEnd(this.currentVersion.toString(), 6, '.0');
	}

	async enable() {
		this.currentVersion = await getVersion();

		this.#maybeShowChangelog();
	}

	disable() {}

	#maybeShowChangelog(): void {
		if (!this.settings.version || gt(this.currentVersion, this.settings.version)) {
			this.openChangelog();

			app.modal.on('close', () => {
				this.settings.version = this.currentVersion;
			});
		}
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
