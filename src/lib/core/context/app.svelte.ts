import type { Lobby } from './lobby.svelte';
import type { Features, RelicProfile } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import type { TypedPocketBase } from '$core/pocketbase/types';
import { dev } from '$app/environment';
import { Store } from '@tauri-apps/plugin-store';
import { z } from 'zod';
import { defaultsDeep } from 'lodash-es';
import { Paths } from '$core/paths';
import { modal } from '$lib/components/ui/modal';
import { exists } from '@tauri-apps/plugin-fs';
import { ModalSettings } from '$lib/components/modals';
import { watch } from 'runed';
import { toast } from 'svelte-sonner';
import { game } from './game.svelte';
import { log } from '$core/log-parser';
import { pocketbase } from '$core/pocketbase';
import { database } from '$core/app/database';
import { SvelteMap } from 'svelte/reactivity';
import { Socket, SocketState } from '$core/app/socket.svelte';
import GameStartedNotificationAudio from '$lib/files/game-started-stop-watch-effect.mp3?url';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

export const appSettingsSchema = z
	.object({
		autostart: z.boolean().default(true),
		isStreamer: z.boolean().default(false),
		companyOfHeroesConfigPath: z.string().default(''),
		companyOfHeroesInstallationPath: z.string().default('')
	})
	.loose();

export type AppSettings = z.infer<typeof appSettingsSchema> & {
	[key: string]: any;
};
export type Status = 'idle' | 'loading' | 'error' | 'success';
export type Statuses = {
	companyOfHeroes: Status;
	webserver: Status;
	websocketServer: Status;
};

export class AppContext {
	/**
	 * Indicates whether the application is ready.
	 *
	 * @public
	 * @type {boolean}
	 * @default false
	 */
	isReady: boolean = $state(false);

	/**
	 * The store instance for persistent data storage.
	 *
	 * @public
	 * @type {Store}
	 */
	store!: Store;

	/**
	 * The paths utility for managing application paths.
	 *
	 * @public
	 * @type {Paths}
	 */
	paths!: Paths;

	/**
	 * The modal manager for handling modal dialogs.
	 *
	 * @public
	 * @type {typeof modal}
	 */
	modal = modal;

	/**
	 * Toast notification system.
	 *
	 * @public
	 * @type {typeof toast}
	 */
	toast = toast;

	/**
	 * The game context for managing game state and events.
	 *
	 * @public
	 * @type {Game}
	 */
	game = game;

	/**
	 * The current lobby context.
	 *
	 * @public
	 * @type {Lobby | null}
	 */
	lobby = $state<Lobby | null>(null);

	/**
	 * The log parser for handling game logs.
	 *
	 * @public
	 * @type {typeof log}
	 */
	log = log;

	/**
	 * The database instance for managing data storage and retrieval.
	 *
	 * @public
	 * @type {Database}
	 */
	database = database;

	/**
	 * The PocketBase instance for backend interactions.
	 *
	 * @public
	 * @type {TypedPocketBase}
	 */
	pocketbase: TypedPocketBase = pocketbase;

	/**
	 * The WebSocket connection for real-time communication.
	 *
	 * @public
	 * @type {Socket}
	 */
	socket: Socket | null = $state(null);

	/**
	 * Audio element for playing notification sounds.
	 *
	 * @public
	 * @type {HTMLAudioElement}
	 */
	audio: HTMLAudioElement = new Audio();

	/**
	 * Reactive object holding the application's settings.
	 * Loaded from the store or initialized with defaults.
	 *
	 * @public
	 * @type {AppSettings}
	 */
	settings: AppSettings = $state({
		autostart: true,
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
	 * Registered features within the application context.
	 *
	 * @public
	 * @type {Features}
	 */
	_features: SvelteMap<keyof Features, Features[keyof Features]> = new SvelteMap<
		keyof Features,
		Features[keyof Features]
	>();

	get features(): Features {
		return Object.fromEntries(this._features) as unknown as Features;
	}

	async start(): Promise<AppContext> {
		$effect.root(() => {
			this.trackStatuses();

			watch(
				() => $state.snapshot(this.settings),
				() => {
					this.store?.set('settings', this.settings);
					this.store?.save();
				}
			);
			watch(
				() => [this.settings.companyOfHeroesConfigPath],
				() => {
					if (dev || this.game.isRunning) {
						log.start(this.settings.companyOfHeroesConfigPath);
					}
				}
			);
			watch(
				() => this.settings.autostart,
				(autostart) => {
					isEnabled().then(async (isEnabledAutostart) => {
						if (autostart && !isEnabledAutostart) {
							await enable();
						}

						if (!autostart && isEnabledAutostart) {
							await disable();
						}
					});
				}
			);
			watch(
				() => [this.lobby?.startedAt, this.game.isWindowFocused],
				() => {
					if (
						this.isReady &&
						this.lobby?.startedAt &&
						!this.game.isWindowFocused &&
						!this.lobby.didNotify &&
						!this.lobby.started
					) {
						this.audio.src = GameStartedNotificationAudio;
						this.audio.currentTime = 0;
						this.lobby!.didNotify = true;

						this.audio.play();
					}

					if (this.game.isWindowFocused) {
						this.audio.pause();
					}
				}
			);
		});

		this.paths = new Paths(this);
		this.store = await Store.load(dev ? 'app.dev.json' : 'app.json');
		this.settings = await this.loadSettings();
		this.socket = await Socket.connect();

		log.on('log.authenticated', ({ steamId, relicProfile, steamProfile }) =>
			this.onAuthenticated(steamId, relicProfile, steamProfile)
		);
		log.on('log.logout', () => this.onLogout());
		log.on('log.lobby.started', (lobby) => this.onLobbyStarted(lobby));
		log.on('log.lobby.result', ({ playerId, result }) => this.onLobbyResult(playerId, result));
		log.on('log.lobby.destroyed', () => this.onLobbyDestroyed());

		for await (const feature of this._features.values()) {
			await feature.register();
		}

		return this;
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

	async loadSettings() {
		const storedSettings = await this.store.get<AppSettings>('settings');

		if (storedSettings) {
			this.settings = defaultsDeep(storedSettings, this.settings);
		}

		const { success, data, error } = appSettingsSchema.safeParse(this.settings);

		if (success === false) {
			throw console.error('App settings validation failed:', error);
		}

		// If there are validation errors related to critical paths, show the settings modal
		if (
			(await exists(data.companyOfHeroesConfigPath)) === false ||
			(await exists(data.companyOfHeroesInstallationPath)) === false
		) {
			this.modal.create({
				title: 'Invalid Configuration',
				description: 'Please set the correct Company of Heroes configuration paths to continue.',
				size: 'lg',
				component: ModalSettings
			});
			this.modal.open();
		}

		return data;
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

	private onAuthenticated(
		steamId: string,
		relicProfile: RelicProfile,
		steamProfile: SteamPlayerSummary
	) {
		this.game.profile = { relic: relicProfile, steam: steamProfile };
		this.game.steamId = steamId;

		this.features.auth.attachSteamId(steamId);

		this.game;
	}

	private onLogout() {
		this.game.close();
	}

	private onLobbyStarted(lobby: Lobby) {
		this.lobby = lobby;
		this.socket?.publish('game.lobby.started', this.lobby);
	}

	private onLobbyDestroyed() {
		this.lobby = null;
		this.socket?.publish('game.lobby.destroyed', null);
	}

	private onLobbyResult(playerId: number, result: 'PS_WON' | 'PS_KILLED') {
		if (playerId === this.lobby?.me?.playerId) {
			this.lobby!.outcome = result;
		}
	}
}

export const app = new AppContext();
