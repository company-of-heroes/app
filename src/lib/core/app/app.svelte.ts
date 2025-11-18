import type { Component } from 'svelte';
import type { Plugins } from '@fknoobs/app';
import Emittery from 'emittery';
import Websocket from '@tauri-apps/plugin-websocket';
import { page } from '$app/state';
import { PathMatcher } from '$lib/utils/path-matcher';
import { Store } from '@tauri-apps/plugin-store';
import { watch } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import { merge } from 'lodash-es';
import { toast } from 'svelte-sonner';
import { game } from '$core/company-of-heroes';
import { log } from '$core/log-parser';
import { Socket } from './socket.svelte';

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
	[key: string]: any;
};

export type AppEvents = {
	boot: App;
	install: never;
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
		companyOfHeroesConfigPath: ''
	});

	/**
	 * The persistent store for application data.
	 *
	 * @public
	 * @type {Store}
	 */
	store!: Store;

	/**
	 * Toast notification system.
	 *
	 * @public
	 * @type {typeof toast}
	 */
	toast = toast;

	/**
	 * The game instance for managing game-related state and events.
	 *
	 * @public
	 * @type {Game}
	 */
	game = game;

	/**
	 * The WebSocket connection for real-time communication.
	 *
	 * @public
	 * @type {Socket}
	 */
	socket: Socket | null = $state(null);

	/**
	 * A reactive map holding instances of application modules.
	 *
	 * @public
	 * @type {SvelteMap<keyof Plugins, Plugins[keyof Plugins]>}
	 */
	private _plugins = new SvelteMap<keyof Plugins, Plugins[keyof Plugins]>();

	/**
	 * Starts the application by loading settings and initializing plugins.
	 */
	async start() {
		this.store = await Store.load('app.json');
		this.settings = await this.loadSettings();
		this.socket = await Socket.connect();

		this.socket.subscribe('game.lobby.started');
		this.socket.subscribe('game.lobby.destroyed');

		app.game.on('LOBBY:STARTED', (lobby) => {
			this.socket?.publish('game.lobby.started', lobby);
		});

		app.game.on('LOBBY:DESTROYED', () => {
			this.socket?.publish('game.lobby.destroyed', null);
		});

		log.start();

		$effect.root(() => {
			watch(
				() => $state.snapshot(this.settings),
				() => {
					this.store?.set('settings', this.settings);
					this.store?.save();
				}
			);
		});

		for await (const plugin of this._plugins.values()) {
			await plugin.register();
		}
	}

	/**
	 * Loads the application settings from the persistent store.
	 *
	 * @returns {Promise<Settings>} A promise that resolves to the loaded settings.
	 */
	async loadSettings() {
		const storedSettings = (await this.store.get('settings')) as Partial<Settings> | undefined;

		if (storedSettings) {
			return merge(this.settings, storedSettings);
		}

		return this.settings;
	}

	/**
	 * Registers a plugin with the application.
	 *
	 * @param name - The name of the plugin.
	 * @param plugin - The plugin instance.
	 */
	register<K extends keyof Plugins>(name: K, plugin: Plugins[K]) {
		this._plugins.set(name, plugin);
	}

	/**
	 * Retrieves a registered plugin by its name.
	 *
	 * @param name - The name of the plugin to retrieve.
	 * @returns The plugin instance if found, otherwise undefined.
	 */
	getPlugin<K extends keyof Plugins>(name: K): Plugins[K] | undefined {
		return this._plugins.get(name) as Plugins[K] | undefined;
	}
}

export const app = new App();
