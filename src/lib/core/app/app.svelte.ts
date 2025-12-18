import type { Component } from 'svelte';
import type { Features } from '@fknoobs/app';
import type { TypedPocketBase } from '$core/pocketbase/types';
import Emittery from 'emittery';
import { fetch } from '@tauri-apps/plugin-http';
import { page } from '$app/state';
import { PathMatcher } from '$lib/utils/path-matcher';
import { Store } from '@tauri-apps/plugin-store';
import { watch } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import { isEmpty, merge } from 'lodash-es';
import { toast } from 'svelte-sonner';
import { game, type Game } from '$core/company-of-heroes';
import { log } from '$core/log-parser';
import { Socket, SocketState } from './socket.svelte';
import { modal } from '$lib/components/ui/modal';
import { documentDir, join, sep } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { dev } from '$app/environment';
import { save, open } from '@tauri-apps/plugin-dialog';
import { Database } from './database';
import { goto } from '$app/navigation';
import { pocketbase } from '$core/pocketbase';

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
	ready: never;
};

export type Status = 'idle' | 'loading' | 'error' | 'success';
export type Statuses = {
	companyOfHeroes: Status;
	webserver: Status;
	websocketServer: Status;
};

/**
 * Manages the global state and core functionalities of the application.
 */
export class App extends Emittery<AppEvents> {
	isBooted: boolean = $state(false);

	/**
	 * Indicates whether the app is booted and ready.
	 *
	 * @public
	 * @type {boolean}
	 */
	isReady: boolean = $state(false);

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
		companyOfHeroesInstallationPath: ''
	});

	/**
	 * Reactive object tracking the loading statuses of various application components.
	 *
	 * @public
	 */
	statuses = $state<Statuses>({
		companyOfHeroes: 'idle',
		webserver: 'loading',
		websocketServer: 'loading'
	});

	/**
	 * The persistent store for application data.
	 *
	 * @public
	 * @type {Store}
	 */
	store!: Store;

	/**
	 * The database instance for managing data storage and retrieval.
	 *
	 * @public
	 * @type {Database}
	 */
	database!: Database;

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
	game: Game = game;

	/**
	 * The WebSocket connection for real-time communication.
	 *
	 * @public
	 * @type {Socket}
	 */
	socket: Socket | null = $state(null);

	/**
	 * The modal manager for handling modal dialogs.
	 *
	 * @public
	 * @type {typeof modal}
	 */
	modal = modal;

	/**
	 * The PocketBase instance for backend interactions.
	 *
	 * @public
	 * @type {TypedPocketBase}
	 */
	pocketbase: TypedPocketBase = pocketbase;

	/**
	 * A reactive map holding instances of application modules.
	 *
	 * @public
	 * @type {SvelteMap<keyof Features, Features[keyof Features]>}
	 */
	private _features = new SvelteMap<keyof Features, Features[keyof Features]>();

	/**
	 * Starts the application by loading settings and initializing features.
	 */
	async start() {
		this.store = await Store.load(dev ? 'app.dev.json' : 'app.json');
		this.settings = await this.loadSettings();
		this.socket = await Socket.connect();
		this.database = await Database.load();

		this.game.on('LOBBY:STARTED', async (lobby) => {
			this.socket?.publish('game.lobby.started', lobby);
		});

		this.game.on('LOBBY:DESTROYED', async (lobby) => {
			this.socket?.publish('game.lobby.destroyed', null);
		});

		$effect.root(() => {
			this.trackStatuses();
			this.validateSettings();

			watch(
				() => this.game.isRunning,
				(running) => {
					if (running) {
						log.start();
					} else {
						this.game.close();
					}
				}
			);

			watch(
				() => log.isReady,
				(isReady) => {
					if (isReady) {
						this.socket?.subscribe('game.lobby.started');
						this.socket?.subscribe('game.lobby.destroyed');

						this.emit('ready');
					} else {
						this.socket?.unsubscribe('game.lobby.started');
						this.socket?.unsubscribe('game.lobby.destroyed');
					}

					this.isReady = !!isReady;
				}
			);

			watch(
				() => $state.snapshot(this.settings),
				() => {
					this.store?.set('settings', this.settings);
					this.store?.save();
				}
			);
		});

		for await (const feature of this._features.values()) {
			await feature.register();
		}
	}

	validateSettings() {
		watch(
			() => [app.settings.companyOfHeroesConfigPath, page.url],
			() => {
				setTimeout(async () => {
					const defaultWarningsLogPath = await join(
						await documentDir(),
						'My Games',
						'Company of Heroes Relaunch',
						'warnings.log'
					);
					const defaultInstallationPath = await join(
						'C:',
						'Program Files (x86)',
						'Steam',
						'steamapps',
						'common',
						'Company of Heroes Relaunch'
					);

					if (
						isEmpty(this.settings.companyOfHeroesConfigPath) &&
						(await exists(defaultWarningsLogPath))
					) {
						this.settings.companyOfHeroesConfigPath = defaultWarningsLogPath;
					}

					if (
						isEmpty(this.settings.companyOfHeroesInstallationPath) &&
						(await exists(defaultInstallationPath))
					) {
						this.settings.companyOfHeroesInstallationPath = defaultInstallationPath;
					}

					if (
						(!(await exists(this.settings.companyOfHeroesInstallationPath)) ||
							!(await exists(this.settings.companyOfHeroesConfigPath))) &&
						page.url.pathname !== '/settings'
					) {
						goto('/settings');
					}
				}, 100);
			}
		);
	}

	trackStatuses() {
		const socketStatusMap: Record<SocketState, Status> = {
			[SocketState.Connected]: 'success',
			[SocketState.Disconnected]: 'error',
			[SocketState.Connecting]: 'loading',
			[SocketState.Error]: 'error'
		};

		watch(
			[() => this.socket?.state, () => this.socket, () => this.game.isRunning],
			([state, socket, isRunning]) => {
				this.statuses.websocketServer = !socket ? 'error' : (socketStatusMap[state!] ?? 'loading');
				this.statuses.companyOfHeroes = isRunning ? 'success' : 'idle';
			}
		);

		fetch('http://localhost:9000')
			.then(() => {
				this.statuses.webserver = 'success';
			})
			.catch(() => {
				this.statuses.webserver = 'error';
			});
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
	 * Exports the current application settings to a JSON file.
	 */
	async exportSettings() {
		try {
			const path = await save({
				defaultPath: (await documentDir()) + sep() + 'app-settings.json'
			});

			if (path) {
				writeTextFile(path, JSON.stringify(this.settings, null, 2))
					.then(() => {
						this.toast.success('Settings exported successfully!');
					})
					.catch((err) => {
						this.toast.error('Failed to export settings: ' + err);
					});
			}
		} catch (err) {
			this.toast.error('Failed to export settings: ' + err);
		}
	}

	async importSettings() {
		try {
			const selected = await open({
				multiple: false,
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (selected && typeof selected === 'string') {
				const fileContent = await readTextFile(selected);
				const importedSettings = JSON.parse(fileContent) as Settings;

				if (
					'companyOfHeroesConfigPath' in importedSettings === false ||
					'companyOfHeroesInstallationPath' in importedSettings === false
				) {
					this.toast.error('Invalid settings file');
					return;
				}

				this.settings = importedSettings;
				this.toast.success('Settings imported successfully!');
			}
		} catch (err) {
			this.toast.error('Failed to import settings: ' + err);
		}
	}

	/**
	 * Registers a feature with the application.
	 *
	 * @param name - The name of the feature.
	 * @param feature - The feature instance.
	 */
	register<K extends keyof Features>(name: K, feature: Features[K]) {
		this._features.set(name, feature);
	}

	/**
	 * Retrieves a registered feature by its name.
	 *
	 * @param name - The name of the feature to retrieve.
	 * @returns The feature instance if found, otherwise undefined.
	 */
	getFeature<K extends keyof Features>(name: K): Features[K] | undefined {
		return this._features.get(name) as Features[K] | undefined;
	}

	/**
	 * Retrieves all registered features as an object.
	 *
	 * @returns An object containing all registered features.
	 */
	get features(): Features {
		return Object.fromEntries(this._features) as Features;
	}
}

export const app = new App();
