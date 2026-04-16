import type { Lobby, Match } from './lobby.svelte';
import type { Features, RelicProfile } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import type { TypedPocketBase } from '$core/pocketbase/types';
import { dev } from '$app/environment';
import { Store } from '@tauri-apps/plugin-store';
import { z } from 'zod';
import { defaultsDeep } from 'lodash-es';
import { Paths } from '$core/paths';
import { modal } from '$lib/components/ui/modal';
import { exists, readTextFile, writeTextFile, rename } from '@tauri-apps/plugin-fs';
import { ModalSettings } from '$lib/components/modals';
import { watch } from 'runed';
import { toast } from 'svelte-sonner';
import { game } from './game.svelte';
import { log } from '$core/log-parser';
import { pocketbase } from '$core/pocketbase';
import { database } from '$core/app/database';
import { SvelteMap } from 'svelte/reactivity';
import { Socket, SocketState } from '$core/app/socket.svelte';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import Emittery from 'emittery';
import GameStartedNotificationAudio from '$lib/files/game-started-stop-watch-effect.mp3?url';
import { open, save } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { LOBBY_4V4, RANKED_1V1, RANKED_2V2 } from '$lib/dev';
import { getVersion } from '@tauri-apps/api/app';
import type { ReplayData } from '@fknoobs/replay-parser';
import type { MatchExpanded } from '../database/matches';

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
export type AppEvents = {
	'game.login': { steamId: string; relicProfile: RelicProfile; steamProfile: SteamPlayerSummary };
	'game.logout': null;
	'lobby.started': Match;
	'lobby.destroyed': {
		match: Match;
		replay: {
			file: File;
			replay: ReplayData;
		};
	};
    'lobby.saved': MatchExpanded;
};

export class AppContext extends Emittery<AppEvents> {
	started: boolean = false;
	/**
	 * The application version.
	 *
	 * @public
	 * @type {string}
	 */
	version: string = '';
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
	 * @type {Match | null}
	 */
	lobby = $state.raw<Match | null>();

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
		if (this.started) {
			return this;
		}

		this.version = await getVersion();
		this.paths = new Paths(this);
		this.store = await Store.load(dev ? 'app.dev.json' : 'app.json');
		this.settings = await this.loadSettings();
		this.socket = await Socket.connect();

		for await (const feature of this._features.values()) {
			await feature.register();
		}

		$effect.root(() => {
			this.trackStatuses();

            // Temporary code to simulate lobby state changes during development
            if (dev) {
                setTimeout(() => {
                    this.lobby = RANKED_2V2;
                }, 1000);
                setTimeout(() => {
                    this.lobby = LOBBY_4V4;
                }, 5000);
            }

			watch(
				() => $state.snapshot(this.settings),
				() => {
					this.store?.set('settings', this.settings);
					this.store?.save();
				}
			);
			watch(
				() => [this.settings.companyOfHeroesConfigPath, this.game.isRunning],
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
				() => this.game.isWindowFocused,
				(isFocused) => {
					if (isFocused) {
						this.audio.pause();
					}
				}
			);

			log.on('log.ready', () => {
				this.isReady = true;
			});
			log.on('log.authenticated', ({ steamId, relicProfile, steamProfile }) =>
				this.onAuthenticated(steamId, relicProfile, steamProfile)
			);
			log.on('log.logout', () => this.onLogout());
			log.on('log.lobby.joined', (lobby) => this.onLobbyJoined(lobby));
			log.on('log.lobby.started', (lobby) => this.onLobbyStarted(lobby));
			log.on('log.lobby.result', ({ playerId, result }) => this.onLobbyResult(playerId, result));
			log.on('log.lobby.destroyed', () => this.onLobbyDestroyed());
		});

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
		if (dev) {
			return;
		}

		this.game.close();
	}

	private onLobbyStarted(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		this.lobby = lobby.toJSON();

		this.emit('lobby.started', lobby.toJSON());
		this.socket?.publish('game.lobby.started', lobby.toJSON());

        this.database.lobbiesLive.setLobby(lobby.toJSON());
	}

	private onLobbyJoined(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		if (lobby.startedAt && !lobby.didNotify && !this.game.isWindowFocused) {
			this.audio.src = GameStartedNotificationAudio;
			this.audio.currentTime = 0;
			lobby.didNotify = true;

			this.audio.play();
		}

		if (this.game.isWindowFocused) {
			this.audio.pause();
		}
	}

	private async onLobbyDestroyed() {
		if (!this.isReady) {
			return;
		}

		this.emit('lobby.destroyed', {
			match: this.lobby!,
			replay: await this.features.history.getLastMatchReplay()
		});
		this.socket?.publish('game.lobby.destroyed', this.lobby!);

		this.lobby = null;
	}

	private onLobbyResult(playerId: number, result: 'PS_WON' | 'PS_KILLED') {
		if (!this.isReady) {
			return;
		}

		if (playerId === this.lobby?.me?.playerId) {
			this.lobby!.outcome = result;
		}
	}

	async exportSettings() {
		save({
			defaultPath: await join(await this.paths.documentDir(), 'settings.json'),
			title: 'Export Settings',
			filters: [{ name: 'JSON', extensions: ['json'] }]
		})
			.then(async (path) => {
				if (!path || Array.isArray(path)) {
					app.toast.error('No file selected for export.');
					return;
				}

				const settingsData = await readTextFile(await this.paths.appConfigFilePath());
				await writeTextFile(path, settingsData);
				this.toast.success('Settings exported successfully.');
			})
			.catch((error) => {
				console.error('Failed to export settings:', error);
				this.toast.error('Failed to export settings. Please try again.');
			});
	}

	importSettings() {
		open({
			title: 'Import Settings',
			multiple: false,
			filters: [{ name: 'JSON', extensions: ['json'] }]
		})
			.then(async (path) => {
				if (!path || Array.isArray(path)) {
					app.toast.error('No file selected for import.');
					return;
				}

				// Backup existing settings file
				await rename(
					await this.paths.appConfigFilePath(),
					await join(
						await this.paths.appConfigDir(),
						dev ? 'app.dev.json.backup' : 'app.json.backup'
					)
				);

				const settingsData = await readTextFile(path);
				await writeTextFile(await this.paths.appConfigFilePath(), settingsData);
				app.toast.success(
					'Settings imported successfully. Please restart the application to apply changes.'
				);
			})
			.catch(async (error) => {
				console.error('Failed to import settings:', error);
				app.toast.error('Failed to import settings. Please try again.');

				// Restore from backup on failure
				await rename(
					await join(
						await this.paths.appConfigDir(),
						dev ? 'app.dev.json.backup' : 'app.json.backup'
					),
					await this.paths.appConfigFilePath()
				);
			});
	}

	importSettingsFromObject(settingsObj: AppSettings) {
		return new Promise<void>(async (resolve, reject) => {
			try {
				await rename(
					await this.paths.appConfigFilePath(),
					await join(
						await this.paths.appConfigDir(),
						dev ? 'app.dev.json.backup' : 'app.json.backup'
					)
				);
				const settingsData = JSON.stringify(settingsObj, null, 2);
				await writeTextFile(await this.paths.appConfigFilePath(), settingsData);

				return resolve();
			} catch (error) {
				console.error('Failed to import settings:', error);
				app.toast.error('Failed to import settings. Please try again.');

				await rename(
					await join(
						await this.paths.appConfigDir(),
						dev ? 'app.dev.json.backup' : 'app.json.backup'
					),
					await this.paths.appConfigFilePath()
				);

				return reject(error);
			}
		});
	}
}

export const app = new AppContext();
