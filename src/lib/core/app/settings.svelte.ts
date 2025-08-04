import { defaultTwitchSettings } from '$lib/modules/twitch/twitch.svelte';
import { load, type Store } from '@tauri-apps/plugin-store';
import { Bootable } from './bootable.svelte';

export class Settings extends Bootable {
	/**
	 * Indicates whether the application is in streamer mode.
	 *
	 * @type {boolean}
	 */
	isStreamer: boolean = $state(false);
	/**
	 * Path to the Company of Heroes configuration.
	 *
	 * @type {string}
	 */
	companyOfHeroesConfigPath: string = $state('');
	/**
	 * Twitch module settings.
	 * These are configurable in the UI and persist on disk.
	 *
	 * @type {TwitchSettings}
	 */
	twitch = $state(defaultTwitchSettings);
	/**
	 * PocketBase settings.
	 * These include the email, password, host, and port for the PocketBase server.
	 *
	 * @type {PocketbaseSettings}
	 */
	pocketbase = $state({
		email: 'admin@fknoobs.com',
		password: 'FjSMqICnWtgJ',
		host: '127.0.0.1',
		port: 49240
	});

	async boot() {
		const store = await load('app.json');
		const settings = (await store.get('settings')) || {};

		for (const key in settings) {
			if (key in this) {
				console.log(key);
				this[key as keyof this] = settings[key as keyof typeof settings];
			}
		}

		return this;
	}
}

//export const settings = new Settings();
