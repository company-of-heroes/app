import { Plugin } from '../plugin.svelte';
import { fetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app';
import { Update } from '.';

export class Updater extends Plugin {
	name = 'updater';

	enable() {
		fetch('https://api.github.com/repos/fknoobs/app/releases/latest')
			.then((res) => res.json())
			.then(async (response) => {
				const latestVersion = response.tag_name.replace('v', '');
				const currentVersion = await getVersion();

				console.log(latestVersion, currentVersion);

				if (latestVersion !== currentVersion) {
					app.modal.create({
						component: Update,
						title: 'Update Available',
						description: `A new version (${latestVersion}) is available. You are currently on version ${currentVersion}.`,
						props: {
							currentVersion,
							latestVersion,
							downloadUrl: response.assets.find((a: any) => a.name.endsWith('.exe'))
								.browser_download_url
						}
					});
					app.modal.open();
				}
			});
	}

	defaultSettings() {
		return {
			enabled: true
		};
	}
}

export const updater = new Updater();
