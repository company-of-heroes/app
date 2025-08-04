import type { Modules } from '@fknoobs/app';
import type { Component } from 'svelte';
import { page } from '$app/state';
import { defaultTwitchSettings, Twitch } from '$lib/modules/twitch/twitch.svelte';
import { load, type Store } from '@tauri-apps/plugin-store';
import { appDataDir, documentDir } from '@tauri-apps/api/path';
import Emittery from 'emittery';
import { Game } from '$core/company-of-heroes';
import { PathMatcher } from '$lib/utils/path-matcher';
import { Log } from '$lib/core/log-parser';
import { replays, type Replays } from './replays.svelte';
import { Socket } from './socket.svelte';
import { Pocketbase } from './pocketbase.svelte';
import { Settings } from './settings.svelte';

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
// export type Settings = {
// 	isStreamer: boolean;
// 	companyOfHeroesConfigPath: string;
// 	pocketbase: {
// 		email: string;
// 		password: string;
// 		host: string;
// 		port: number;
// 	};
// 	//[key: string]: any;
// } & Partial<{ [K in keyof Modules]: InstanceType<Modules[K]>['settings'] }>;

export type AppEvents = {
	boot: App;
	install: never;
};

/**
 * Manages the global state and core functionalities of the application.
 */
export class App extends Emittery<AppEvents> {
	isBooted: boolean = $state(false);
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
	settings!: Settings;

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
	game!: Game;

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
	socket!: Socket;

	pocketbase!: Pocketbase;

	/**
	 * Asynchronously initializes the application state.
	 * Loads the persistent store, retrieves settings, and initializes modules (TTS, Twitch).
	 * Sets up a listener for changes in the store to keep the `settings` state updated.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>} A promise that resolves when initialization is complete.
	 */
	async start() {
		const rootDir = await appDataDir();

		if (!rootDir) {
			await this.emit('install');
		}

		this.settings = await new Settings().boot();
		this.pocketbase = await new Pocketbase().boot();
		this.socket = await new Socket().boot();
		this.game = await new Game();

		console.log(this.pocketbase);

		await this.emit('boot', this).then(() => {
			console.log('App booted successfully');
			this.isBooted = true;
		});

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
		//log.on('ISREADY', () => this.replays.load());

		//await this.emit('boot', this);
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
				//window.location.reload();
				//module = this.activeModules.get(name);

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

export const app = new App();
