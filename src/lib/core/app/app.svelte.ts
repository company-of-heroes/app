import type { Component } from 'svelte';
import type { Module } from '$lib/modules/module.svelte';
import { page } from '$app/state';
import Emittery from 'emittery';
import { PathMatcher } from '$lib/utils/path-matcher';
import { Store } from '@tauri-apps/plugin-store';
import { watch } from 'runed';
import { Twitch } from './twitch';
import { SvelteMap } from 'svelte/reactivity';
import { Replays } from './replays.svelte';
import { merge } from 'lodash-es';

/**
 * Defines the structure for a navigation route within the application.
 */
export type Route = {
	title: string;
	href: string;
	path?: string;
	page?: {
		title: string;
		description: string;
	};
	component?: Component;
};

/**
 * Defines the structure for application settings.
 */
export type Settings = {
	isStreamer: boolean;
	companyOfHeroesConfigPath: string;
	twitch: {
		enabled: boolean;
		accessToken: string | null;
		clientId: string;
		tts: {
			enabled: boolean;
			provider: 'brian' | 'elevenlabs';
			messageFormat: string;
			elevenlabsApiKey: string;
			elevenlabs: {
				voiceName: string | undefined;
			};
		};
	};
};

export type AppEvents = {
	boot: App;
	install: never;
};

export type Modules = {
	twitch: Twitch;
};

/**
 * Manages the global state and core functionalities of the application.
 */
export class App extends Emittery<AppEvents> {
	isBooted: boolean = $state(false);

	/*
	 * Reactive array holding the application's navigation routes.
	 *
	 * @public
	 * @type {Route[]}
	 */
	routes: Route[] = $state([]);

	/**
	 * Reactive derived state representing the currently active route based on the browser's URL.
	 *
	 * @public
	 * @type {Route | undefined}
	 */
	route = $derived.by(() => {
		if (page.url.hash) {
			return this.routes.find((route) => route.href === '/' + page.url.hash);
		}

		return this.routes.find((route) =>
			PathMatcher.isMatch(route.path ?? route.href, page.url.pathname)
		);
	});

	/**
	 * Reactive object holding the application's settings.
	 * Loaded from the store or initialized with defaults.
	 *
	 * @public
	 * @type {Settings}
	 */
	settings: Settings = $state({
		isStreamer: false,
		companyOfHeroesConfigPath: '',
		twitch: {
			enabled: false,
			accessToken: null,
			clientId: 'kp4erttmb696osn4inqrlg6qmv5eaq',
			tts: {
				enabled: false,
				provider: 'brian',
				messageFormat: '{user} said, {message}',
				elevenlabsApiKey: '',
				elevenlabs: {
					voiceName: undefined
				}
			}
		}
	});

	/**
	 * The persistent store for application data.
	 *
	 * @public
	 * @type {Store}
	 */
	store!: Store;

	/**
	 * A reactive map holding instances of application modules.
	 *
	 * @public
	 * @type {SvelteMap<keyof Modules, Modules[keyof Modules]>}
	 */
	private _modules = new SvelteMap<keyof Modules, Modules[keyof Modules]>();

	constructor() {
		super();

		$effect.root(() => {
			watch(
				() => $state.snapshot(this.settings),
				() => {
					this.store?.set('settings', this.settings);
					this.store?.save();
				}
			);
		});
	}

	async start() {
		this.store = await Store.load('app.json');

		const storedSettings = (await this.store.get('settings')) as Partial<Settings> | undefined;

		if (storedSettings) {
			this.settings = merge(this.settings, storedSettings);
		}

		this.modules.set('twitch', await new Twitch().register());

		console.log();
		//await this.emit('boot', this);
	}

	get modules() {
		return {
			get: <K extends keyof Modules>(key: K): Modules[K] => {
				return this._modules.get(key) as Modules[K];
			},
			set: <K extends keyof Modules>(key: K, value: Modules[K]): typeof this._modules => {
				return this._modules.set(key, value);
			}
		};
	}
}

export const app = new App();
