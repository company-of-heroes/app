import type { Features, RelicProfile } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import type { TypedPocketBase } from '$core/pocketbase/types';
import type { ReplayData } from '@fknoobs/replay-parser';
import type { MatchExpanded } from '../database/matches';
import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import Emittery from 'emittery';
import { watch } from 'runed';
import { toast } from 'svelte-sonner';
import { SvelteMap } from 'svelte/reactivity';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { modal } from '$lib/components/ui/modal';
import { pocketbase } from '$core/pocketbase';
import { steam } from '$core/steam';
import { relic } from '$lib/relic';
import { settings } from '$core/config/settings.svelte';
import { createEnvelope, parseImportContent, serializeEnvelope } from '$core/config/import-export';
import { validateGameDir, validateWarningsLog } from '$core/config/paths';
import type { AppSettings } from '$core/config/schema';
import { account } from '$core/account';
import { game } from '$core/game/process.svelte';
import { GameLogService } from '$core/game/log/index.svelte';
import { Lobby, type Match } from '$core/game/lobby';
import { database } from '$core/app/database';
import { SocketManager, SocketState } from '$core/app/socket.svelte';
import { LOBBY_4V4, RANKED_2V2 } from '$lib/dev';
import GameStartedNotificationAudio from '$lib/files/game-started-stop-watch-effect.mp3?url';

export type { AppSettings };

export type Status = 'idle' | 'loading' | 'error' | 'success';

/** Feature registry keys (auth is a core service, not a registered feature). */
export type FeatureKey = Exclude<keyof Features, 'auth'>;

export type Statuses = {
	companyOfHeroes: Status;
	webserver: Status;
	websocketServer: Status;
};

export type AppEvents = {
	'game.login': { steamId: string; relicProfile: RelicProfile; steamProfile: SteamPlayerSummary };
	'game.logout': null;
	'lobby.joined': Match;
	'lobby.started': Match;
	'lobby.destroyed': {
		match: Match;
		replay: {
			file: File;
			replay: ReplayData;
		} | null;
	};
	'lobby.saved': MatchExpanded;
};

/**
 * Application facade.
 *
 * Thin integration layer that exposes a stable surface to the UI
 * (`app.settings`, `app.features`, `app.database`, ...) while the actual
 * logic lives in dedicated services (config, account, game, data). The boot
 * pipeline (runtime/boot) drives the lifecycle.
 */
export class AppContext extends Emittery<AppEvents> {
	/** The application version (set during boot). */
	version: string = '';

	/**
	 * Whether the game log has been fully replayed/caught up. Lobby events are
	 * ignored until ready so historical log lines never trigger actions.
	 */
	isReady = $state(false);

	/** Modal manager. */
	modal = modal;

	/** Toast notifications. */
	toast = toast;

	/** Game process state (running / focus / ingame chat). */
	game = game;

	/** Account service (also exposed as `features.auth` for compatibility). */
	account = account;

	/** The currently active lobby (null when not in a game). */
	lobby = $state.raw<Match | null>(null);

	/** Game log watcher + lobby session. */
	gameLog: GameLogService;

	/** Data repositories. */
	database = database;

	/** PocketBase client. */
	pocketbase: TypedPocketBase = pocketbase;

	/** Managed websocket to the local relay server (auto-reconnecting). */
	socket: SocketManager;

	/** Notification audio element. */
	audio: HTMLAudioElement = new Audio();

	statuses = $state<Statuses>({
		companyOfHeroes: 'idle',
		webserver: 'loading',
		websocketServer: 'loading'
	});

	_features: SvelteMap<FeatureKey, Features[FeatureKey]> = new SvelteMap();

	#wired = false;

	constructor() {
		super();

		this.socket = new SocketManager();
		this.gameLog = new GameLogService({
			getProfileBySteamId: (steamId) => relic.getProfileBySteamId(steamId),
			getSteamProfile: (steamId) => steam.getUserProfile(steamId.toString()),
			getProfileByIds: (ids) => relic.getProfileByIds(ids),
			getRecentMatchHistoryForProfile: (profileId) =>
				relic.getRecentMatchHistoryForProfile(profileId)
		});
	}

	/** Reactive app settings slice (single source of truth: config service). */
	get settings(): AppSettings {
		return settings.tree.app;
	}

	/** Paths helper bound to live settings. */
	get paths() {
		return settings.paths;
	}

	get features(): Features {
		return {
			auth: this.account,
			...Object.fromEntries(this._features)
		} as unknown as Features;
	}

	register<K extends FeatureKey>(name: K, feature: Features[K]) {
		this._features.set(name, feature);
	}

	/** Whether the mandatory CoH paths are configured and valid. */
	async isConfigured(): Promise<boolean> {
		const [logResult, dirResult] = await Promise.all([
			validateWarningsLog(this.settings.companyOfHeroesConfigPath),
			validateGameDir(this.settings.companyOfHeroesInstallationPath)
		]);

		return logResult.valid && dirResult.valid;
	}

	/**
	 * Wires reactive watchers and game-log event handlers.
	 * Called exactly once by the boot pipeline.
	 */
	wire(): void {
		if (this.#wired) {
			return;
		}

		this.#wired = true;

		$effect.root(() => {
			this.#trackStatuses();

			// Start/stop the log watcher with the game process.
			watch(
				() => [this.settings.companyOfHeroesConfigPath, this.game.isRunning] as const,
				([path, isRunning]) => {
					if (isRunning && path) {
						this.gameLog.start(path);
					} else {
						this.gameLog.stop();
						this.isReady = false;
					}
				}
			);

			// Keep OS autostart in sync with the setting.
			watch(
				() => this.settings.autostart,
				(autostart) => {
					isEnabled()
						.then(async (enabled) => {
							if (autostart && !enabled) {
								await enable();
							}

							if (!autostart && enabled) {
								await disable();
							}
						})
						.catch((error) => {
							console.warn('[APP]: autostart sync failed:', error);
						});
				}
			);

			// Stop the notification sound once the game window gets focus.
			watch(
				() => this.game.isWindowFocused,
				(isFocused) => {
					if (isFocused) {
						this.audio.pause();
					}
				}
			);

			// Dev: simulate lobby state changes.
			// if (dev) {
			// 	setTimeout(() => {
			// 		this.lobby = RANKED_2V2 as unknown as Match;
			// 	}, 1000);
			// 	setTimeout(() => {
			// 		this.lobby = LOBBY_4V4 as unknown as Match;
			// 	}, 5000);
			// }
		});

		this.gameLog.on('ready', () => {
			this.isReady = true;
		});

		this.gameLog.on('authenticated', ({ steamId, relicProfile, steamProfile }) =>
			this.#onAuthenticated(
				steamId,
				relicProfile as RelicProfile,
				steamProfile as SteamPlayerSummary
			)
		);

		this.gameLog.on('logout', () => this.#onLogout());
		this.gameLog.on('lobby.joined', (lobby) => this.#onLobbyJoined(lobby));
		this.gameLog.on('lobby.started', (lobby) => this.#onLobbyStarted(lobby));
		this.gameLog.on('lobby.result', ({ playerId, result }) =>
			this.#onLobbyResult(playerId, result)
		);
		this.gameLog.on('lobby.destroyed', () => this.#onLobbyDestroyed());
	}

	#trackStatuses() {
		const socketStatusMap: Record<SocketState, Status> = {
			[SocketState.Connected]: 'success',
			[SocketState.Disconnected]: 'error',
			[SocketState.Connecting]: 'loading',
			[SocketState.Error]: 'error'
		};

		watch(
			[() => this.socket.current?.state, () => this.socket.current, () => this.game.isRunning],
			([state, current, isRunning]) => {
				this.statuses.websocketServer = !current ? 'error' : (socketStatusMap[state!] ?? 'loading');
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

	async #onAuthenticated(
		steamId: string,
		relicProfile: RelicProfile,
		steamProfile: SteamPlayerSummary
	) {
		this.game.profile = { relic: relicProfile, steam: steamProfile };
		this.game.steamId = steamId;

		try {
			await this.account.attachSteamId(steamId);
		} catch (error) {
			console.warn('[APP]: Failed to attach Steam ID:', error);
		}

		this.emit('game.login', { steamId, relicProfile, steamProfile });
	}

	#onLogout() {
		if (dev) {
			return;
		}

		this.game.close();
	}

	#onLobbyJoined(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		if (lobby.startedAt && !lobby.didNotify && !this.game.isWindowFocused) {
			this.audio.src = GameStartedNotificationAudio;
			this.audio.currentTime = 0;
			lobby.didNotify = true;

			this.audio.play().catch(() => undefined);
		}

		if (this.game.isWindowFocused) {
			this.audio.pause();
		}

		this.emit('lobby.joined', lobby.toJSON());
		this.socket.publish('game.lobby.joined', lobby.toJSON());
	}

	#onLobbyStarted(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		this.lobby = lobby.toJSON();
		console.log('lobby started', lobby.toJSON());

		this.emit('lobby.started', lobby.toJSON());
		this.socket.publish('game.lobby.started', lobby.toJSON());

		this.database.lobbiesLive
			.setLobby(lobby.toJSON(), this.account.userId)
			.catch((error) => console.warn('[APP]: lobbies_live upsert failed:', error));
	}

	#onLobbyResult(playerId: number, result: 'PS_WON' | 'PS_KILLED') {
		if (!this.isReady) {
			return;
		}

		if (this.lobby && playerId === this.lobby.me?.playerId) {
			this.lobby.outcome = result;
		}
	}

	async #onLobbyDestroyed() {
		if (!this.isReady || !this.lobby) {
			return;
		}

		const match = this.lobby;
		let replay: { file: File; replay: ReplayData } | null = null;

		try {
			replay = await this.features.history.getLastMatchReplay();
		} catch (error) {
			console.warn('[APP]: Could not read last match replay:', error);
		}

		this.emit('lobby.destroyed', { match, replay });
		this.socket.publish('game.lobby.destroyed', match);

		this.lobby = null;
	}

	/**
	 * Exports the full settings tree (including feature settings and account)
	 * as a versioned envelope to a user-chosen file.
	 */
	async exportSettings(): Promise<void> {
		try {
			const path = await save({
				defaultPath: await join(await this.paths.documentDir(), 'fknoobs-settings.json'),
				title: 'Export Settings',
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (!path) {
				return;
			}

			const envelope = createEnvelope(settings.snapshot(), this.version);
			await writeTextFile(path, serializeEnvelope(envelope));

			this.toast.success('Settings exported successfully.');
		} catch (error) {
			console.error('[APP]: Failed to export settings:', error);
			this.toast.error('Failed to export settings. Please try again.');
		}
	}

	/**
	 * Imports settings from a file. Validates first, then applies live (no
	 * restart needed). A pre-import backup is written automatically.
	 */
	async importSettings(): Promise<void> {
		try {
			const path = await open({
				title: 'Import Settings',
				multiple: false,
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (!path || Array.isArray(path)) {
				return;
			}

			const content = await readTextFile(path);
			const parsed = parseImportContent(content);

			if (!parsed.success) {
				this.toast.error(`Import rejected: ${parsed.error}`);
				return;
			}

			const result = await settings.replace(parsed.data);

			if (!result.success) {
				this.toast.error(`Import rejected: ${result.error}`);
				return;
			}

			this.toast.success('Settings imported and applied.');

			// Imported paths may be invalid on this machine: send the user
			// through the setup wizard instead of failing silently.
			if (!(await this.isConfigured())) {
				await goto('/setup');
			}
		} catch (error) {
			console.error('[APP]: Failed to import settings:', error);
			this.toast.error('Failed to import settings. Please try again.');
		}
	}
}

export const app = new AppContext();
