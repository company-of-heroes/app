import type { Modules } from '@fknoobs/app';
import type { Component } from 'svelte';
import { page } from '$app/state';
import { defaultTwitchSettings, Twitch } from '$lib/modules/twitch/twitch.svelte';
import { load, type Store } from '@tauri-apps/plugin-store';
import { documentDir } from '@tauri-apps/api/path';
import Emittery from 'emittery';
import { game, type Game } from '$core/company-of-heroes';
import { PathMatcher } from '$lib/utils/path-matcher';
import { Log } from '$lib/core/log-parser';
import { replays, type Replays } from './replays.svelte';
import { socket } from './socket.svelte';

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
	//[key: string]: any;
} & Partial<{ [K in keyof Modules]: InstanceType<Modules[K]>['settings'] }>;

export type AppEvents = {
	boot: App;
};

/**
 * Manages the global state and core functionalities of the application.
 */
export class App extends Emittery<AppEvents> {
	/**
	 * Reactive array holding the application's navigation routes.
	 *
	 * @public
	 * @type {Route[]}
	 */
	routes: Route[] = $state([
		{
			href: '/',
			path: '/',
			title: 'Dashboard'
		},
		{
			href: '/leaderboards',
			path: '/leaderboards',
			title: 'Leaderboards'
		},
		{
			href: '/replays',
			path: '/replays',
			title: 'Replays'
		}
	]);

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
	 * Instance of the Tauri store plugin for persistent data storage.
	 * Initialized in the `load` method. Undefined until initialization.
	 *
	 * @public
	 * @type {Store | undefined}
	 */
	store!: Store;

	/**
	 * Reactive object holding the application's settings.
	 * Loaded from the store or initialized with defaults.
	 *
	 * @public
	 * @type {Settings}
	 */
	settings: Settings = $state({
		/**
		 * Indicates if the user is a streamer.
		 * When enabled some more advanced features are available.
		 */
		isStreamer: false,
		/**
		 * Path to the Company of Heroes configuration folder.
		 * This is used to retrieve game settings, configurations and logs.
		 */
		companyOfHeroesConfigPath: '',
		/**
		 * Twitch module settings.
		 * This includes the Twitch API client ID and other related settings.
		 *
		 * The default settings are defined in the Twitch module.
		 */
		twitch: defaultTwitchSettings
	});

	/**
	 * A record mapping module names (strings) to their corresponding class constructors.
	 * This allows for dynamic instantiation or referencing of modules within the application.
	 *
	 * @public
	 * @type {Record<string, new () => Module>}
	 */
	modules: Modules = {
		twitch: Twitch
	};

	/**
	 * Reactive array holding instances of the active modules.
	 *
	 * @public
	 * @type {Map<string, InstanceType<Modules[keyof Modules]>>} // Store module instances keyed by name
	 */
	activeModules = $state(new Map<keyof Modules, InstanceType<Modules[keyof Modules]>>());

	/**
	 * This is the main game object that holds the game's state, players, and other related data.
	 *
	 * @public
	 * @type {Game}
	 */
	game: Game = game;

	/**
	 * Instance of the Replays class, which manages replay files and their data.
	 * This is initialized in the `boot` method.
	 *
	 * @public
	 * @type {Replays}
	 */
	replays: Replays = $derived(replays);

	/**
	 * Instance of the Socket class, to ineract with the WebSocket server.
	 *
	 * @public
	 * @type {Socket}
	 */
	socket = socket;

	/**
	 * Asynchronously initializes the application state.
	 * Loads the persistent store, retrieves settings, and initializes modules (TTS, Twitch).
	 * Sets up a listener for changes in the store to keep the `settings` state updated.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>} A promise that resolves when initialization is complete.
	 */
	async boot() {
		this.store = await load('app.json');
		this.settings = (await this.store.get('settings')) ?? this.settings;

		if (!this.settings.companyOfHeroesConfigPath) {
			this.settings.companyOfHeroesConfigPath =
				(await documentDir()).replaceAll('\\', '/') + '/My Games/Company of Heroes Relaunch';
		}

		for await (const moduleConstructor of Object.values(this.modules)) {
			const mod = new moduleConstructor() as InstanceType<Modules[keyof Modules]>;
			await mod.register();

			this.activeModules.set(mod.name as keyof Modules, mod);
			this.routes.push({
				component: mod.component,
				title: mod.menuItemName,
				href: `/#${mod.name}`
			});
		}

		const log = new Log();
		log.start();
		socket.start();
		//log.on('ISREADY', () => this.replays.load());

		this.emit('boot', this);
	}

	/**
	 * Gets an instance of a module by its name.
	 *
	 * @param name
	 * @returns {InstanceType<Modules[K]>}
	 * @throws {Error} If the module with the specified name is not found.
	 */
	getModule<K extends keyof Modules>(name: K): InstanceType<Modules[K]> {
		let module = this.activeModules.get(name);

		if (!module) {
			if (import.meta.env.DEV && window) {
				window.location.reload();
				module = this.activeModules.get(name);

				if (!module) {
					throw new Error(`Module ${name} not found after reload`);
				} else {
					return module as InstanceType<Modules[K]>;
				}
			}

			throw new Error(`Module ${name} not found`);
		}

		return module as InstanceType<Modules[K]>;
	}
}

/**
 * Singleton instance of the App class, providing global access to application state and methods.
 */
export const app = new App();
