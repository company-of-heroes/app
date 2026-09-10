import type { Features, RelicProfile } from '@fknoobs/app';
import type { TypedPocketBase } from '$core/pocketbase/types';
import type { FlatReplay } from '$lib/utils/flatten-replay';
import type { MatchExpanded } from '../database/matches';
import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import type { SteamPlayerSummary } from '$core/steam';
import Emittery from 'emittery';
import { watch } from 'runed';
import { toast } from '$lib/components/ui/toasts';
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
import {
	isPlaceholderPlayerName,
	Lobby,
	lobbyPublishKey,
	type Match
} from '$core/game/lobby';
import { database } from '$core/app/database';
import { LOBBIES_LIVE_HEARTBEAT_MS } from '$core/app/database/lobbies-live';
import { SocketManager, SocketState } from '$core/app/socket.svelte';
import { notifications as notificationsService } from '$core/notifications/notifications.svelte';
import { startTray } from '$core/app/tray.svelte';
import { LOBBY_4V4, RANKED_2V2 } from '$lib/dev';
import GameStartedNotificationAudio from '$lib/files/game-started-stop-watch-effect.mp3?url';
import { t } from '$lib/i18n';

export type { AppSettings };

export type Status = 'idle' | 'loading' | 'error' | 'success';

/** Feature registry keys (auth is a core service, not a registered feature). */
export type FeatureKey = Exclude<keyof Features, 'auth'>;

export type Statuses = {
	companyOfHeroes: Status;
	websocketServer: Status;
};

export type AppEvents = {
	'game.login': { steamId: string; relicProfile: RelicProfile; steamProfile: SteamPlayerSummary };
	'game.logout': null;
	'lobby.joined': Match;
	'lobby.started': Match;
	'lobby.missionStarting': Match | null;
	'lobby.gameover': Match;
	'lobby.destroyed': {
		match: Match;
		replay: {
			file: File;
			replay: FlatReplay | null;
		} | null;
	};
	'lobby.saved': MatchExpanded;
	'match.result': MatchExpanded;
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

	/** In-app notification inbox. */
	notifications = notificationsService;

	/** PocketBase client. */
	pocketbase: TypedPocketBase = pocketbase;

	/** Managed websocket to the local relay server (auto-reconnecting). */
	socket: SocketManager;

	/** Notification audio element. */
	audio: HTMLAudioElement = new Audio();

	statuses = $state<Statuses>({
		companyOfHeroes: 'idle',
		websocketServer: 'loading'
	});

	_features: SvelteMap<FeatureKey, Features[FeatureKey]> = new SvelteMap();

	#wired = false;
	#logStopTimer: ReturnType<typeof setTimeout> | null = null;
	#liveLobbyHeartbeat: ReturnType<typeof setInterval> | null = null;
	/** Bumps on clear/start so in-flight upserts don't resurrect a deleted row. */
	#liveLobbyGeneration = 0;
	/** Emits `lobby.saved` once when the server hook links a durable lobby id. */
	#durableLobbyEmittedKey: string | null = null;
	/** True once the game process has been seen running this session. */
	#hadGameRunning = false;
	/** Last published `game.lobby.joined` match key (once per match). */
	#publishedJoinedKey: string | null = null;
	/** Last published `game.lobby.started` match key (once per match). */
	#publishedStartedKey: string | null = null;
	/** Avoids rescanning playback recs for the same replay lobby. */
	#replayNameAttachKey: string | null = null;

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

		void startTray({
			shouldCloseToTray: () => this.settings.closeToTray !== false,
			onQuit: () => this.database.lobbiesLive.removeLobby().then(() => undefined)
		});

		$effect.root(() => {
			this.#trackStatuses();

			// Start/stop the log watcher with the game process.
			watch(
				() => [this.settings.companyOfHeroesConfigPath, this.game.isRunning] as const,
				([path, isRunning]) => {
					if (this.#logStopTimer) {
						clearTimeout(this.#logStopTimer);
						this.#logStopTimer = null;
					}

					if (isRunning && path) {
						this.#hadGameRunning = true;
						this.isReady = false;
						this.gameLog.start(path);
						return;
					}

					if (!path) {
						this.gameLog.stop();
						this.isReady = false;
						if (this.#hadGameRunning) {
							void this.#finalizeLobbyOnGameExit();
						}
						return;
					}

					// Initial boot: game isn't running — don't hit PB to clear nothing.
					if (!this.#hadGameRunning) {
						this.isReady = false;
						return;
					}

					// Process exit can flicker briefly; pause immediately and only
					// reset after the game stays closed. Also clear lobbies_live —
					// Alt+F4 / Exit to Windows often skips APP -- Game Stop.
					this.isReady = false;
					this.gameLog.pause();
					this.#logStopTimer = setTimeout(() => {
						this.gameLog.stop();
						this.#logStopTimer = null;
						void this.#finalizeLobbyOnGameExit();
					}, 2500);
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

			// Start/stop PocketBase notification subscriptions with auth.
			watch(
				() => this.account.isAuthenticated,
				(isAuthenticated) => {
					if (isAuthenticated) {
						void this.notifications.start();
					} else {
						void this.notifications.stop();
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
		this.gameLog.on('lobby.missionStarting', (lobby) => this.#onLobbyMissionStarting(lobby));
		this.gameLog.on('lobby.gameover', (lobby) => this.#onLobbyGameover(lobby));
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
		if (this.#logStopTimer) {
			clearTimeout(this.#logStopTimer);
			this.#logStopTimer = null;
		}

		this.gameLog.stop();
		this.isReady = false;
		this.#clearLiveLobbyOnGameExit();

		if (dev) {
			return;
		}

		this.game.close();
	}

	async #onLobbyJoined(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		if (!this.#claimLobbyPublish('joined', lobby)) {
			return;
		}

		const shouldNotify =
			!lobby.isReplay && this.game.isRunning && Boolean(lobby.startedAt) && !lobby.didNotify;

		if (shouldNotify) {
			// Fresh focus check — polled `isWindowFocused` can still say "in game"
			// for up to ~1s after the user alt-tabs out.
			const focused = await this.game.refreshWindowFocus();

			if (!focused) {
				lobby.didNotify = true;
				this.#playGameStartedSound();
			}
		}

		if (this.game.isWindowFocused) {
			this.audio.pause();
		}

		this.game.closeIngameChatOpen();
		this.emit('lobby.joined', lobby.toJSON());
		this.socket.publish('game.lobby.joined', lobby.toJSON());
	}

	#playGameStartedSound() {
		const audio = new Audio(GameStartedNotificationAudio);
		this.audio = audio;
		void audio.play().catch((error) => {
			console.warn('[APP]: match start notification sound failed:', error);
		});
	}

	#onLobbyMissionStarting(lobby: Lobby | undefined) {
		if (!this.isReady) {
			return;
		}

		// Enter in the lobby toggles this flag; CoH closes that chat when the
		// mission starts. A leftover true would block shortcuts and used to skip
		// the fair-play announce.
		this.game.closeIngameChatOpen();
		this.emit('lobby.missionStarting', lobby ? lobby.toJSON() : this.lobby);
	}

	#onLobbyStarted(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		const isFirstPublish = this.#claimLobbyPublish('started', lobby);
		const match = lobby.toJSON();

		// Always refresh local lobby (covers post-start profile/history enrichment).
		this.lobby = match;

		const waitingForReplayNames =
			lobby.isReplay && lobby.players.some((player) => isPlaceholderPlayerName(player.name));

		if (!isFirstPublish) {
			if (!waitingForReplayNames) {
				this.#upsertLiveLobby(match);
			}

			if (lobby.isReplay) {
				void this.#attachReplayPlayerNames(lobby);
			}

			return;
		}

		// Invalidate in-flight upserts from a previous lobby without deleting the new row.
		this.#liveLobbyGeneration += 1;
		this.#durableLobbyEmittedKey = null;
		this.#stopLiveLobbyHeartbeat();

		console.log('lobby started', match);

		this.game.isIngame = true;
		this.emit('lobby.started', match);
		this.socket.publish('game.lobby.started', match);

		this.#upsertLiveLobby(match);
		this.#startLiveLobbyHeartbeat();
		if (lobby.isReplay) {
			void this.#attachReplayPlayerNames(lobby);
		}
	}

	async #attachReplayPlayerNames(lobby: Lobby): Promise<void> {
		if (!lobby.isReplay || !lobby.map) return;
		if (!lobby.players.some((player) => isPlaceholderPlayerName(player.name))) return;
		const key = lobbyPublishKey(lobby);
		if (!key || this.#replayNameAttachKey === key) return;
		this.#replayNameAttachKey = key;
		try {
			const recPlayers = await this.features.history.findReplayHeaderPlayers(lobby);
			if (this.gameLog.lobby !== lobby) return;
			if (recPlayers?.length) {
				lobby.applyReplayPlayerNames(recPlayers);
			}
			const match = lobby.toJSON();
			this.lobby = match;
			this.#upsertLiveLobby(match);
		} catch (error) {
			console.warn('[APP]: failed to attach replay player names:', error);
		}
	}

	#onLobbyGameover(lobby: Lobby) {
		if (!this.isReady) {
			return;
		}

		this.game.isIngame = false;
		this.game.closeIngameChatOpen();

		if (this.lobby) {
			this.lobby = { ...this.lobby, ended: true };
		}

		this.emit('lobby.gameover', this.lobby ?? lobby.toJSON());
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
		// Do not require isReady — process exit may flip it false while Game Stop
		// is still reading temp.rec / emitting lobby.destroyed.
		if (!this.lobby) {
			return;
		}

		const match = this.lobby;
		let replay: { file: File; replay: FlatReplay | null } | null = null;

		if (!match.isReplay) {
			try {
				replay = await this.features.history.getLastMatchReplay();
			} catch (error) {
				console.warn('[APP]: Could not read last match replay:', error);
			}
		}

		this.emit('lobby.destroyed', { match, replay });
		this.socket.publish('game.lobby.destroyed', match);

		this.game.isIngame = false;
		this.game.closeIngameChatOpen();
		this.#clearLiveLobbyOnGameExit();
	}

	/**
	 * On abrupt quit (no APP -- Game Stop), still try to attach temp.rec before
	 * clearing live lobby state. No-op when destroy already cleared `this.lobby`.
	 */
	async #finalizeLobbyOnGameExit() {
		const match = this.lobby;
		if (
			match &&
			!match.isReplay &&
			match.sessionId &&
			match.started &&
			this.features.history?.enabled
		) {
			let replayFile: File | null = null;
			try {
				const replay = await this.features.history.getLastMatchReplay();
				replayFile = replay?.file ?? null;
			} catch (error) {
				console.warn('[APP]: Could not read replay on game exit:', error);
			}

			try {
				await this.features.history.saveLobbyResult(match, replayFile);
			} catch (error) {
				console.warn('[APP]: Could not save match on game exit:', error);
			}
		}

		this.#clearLiveLobbyOnGameExit();
	}

	/** Heartbeat keeps updatedAt fresh so long matches aren't pruned as stale. */
	#startLiveLobbyHeartbeat() {
		this.#stopLiveLobbyHeartbeat();
		const generation = this.#liveLobbyGeneration;

		this.#liveLobbyHeartbeat = setInterval(() => {
			if (!this.lobby || generation !== this.#liveLobbyGeneration) {
				this.#stopLiveLobbyHeartbeat();
				return;
			}

			this.#upsertLiveLobby(this.lobby);
		}, LOBBIES_LIVE_HEARTBEAT_MS);
	}

	#stopLiveLobbyHeartbeat() {
		if (this.#liveLobbyHeartbeat) {
			clearInterval(this.#liveLobbyHeartbeat);
			this.#liveLobbyHeartbeat = null;
		}
	}

	/**
	 * Upserts lobbies_live. The PocketBase hook creates/links the durable
	 * `lobbies` row and sets `lobby` on the live record — client does not.
	 */
	#upsertLiveLobby(match: Match) {
		const generation = this.#liveLobbyGeneration;
		this.database.lobbiesLive
			.setLobby(match)
			.then((row) => {
				// Cleared while in flight — delete the resurrected row.
				if (generation !== this.#liveLobbyGeneration && !this.lobby) {
					return this.database.lobbiesLive.removeLobby();
				}

				const lobbyId = typeof row?.lobby === 'string' && row.lobby ? row.lobby : null;
				if (!lobbyId || !this.lobby) {
					return;
				}

				if (Number(this.lobby.sessionId) !== Number(match.sessionId)) {
					return;
				}

				const key = `${match.sessionId}:${lobbyId}`;
				if (this.#durableLobbyEmittedKey === key) {
					return;
				}

				this.#durableLobbyEmittedKey = key;
				this.emit('lobby.saved', {
					id: lobbyId,
					sessionId: match.sessionId
				} as MatchExpanded);
			})
			.catch((error) => console.warn('[APP]: lobbies_live upsert failed:', error));
	}

	/** Clears local lobby state and deletes the user's lobbies_live row. */
	#clearLiveLobbyOnGameExit() {
		this.#liveLobbyGeneration += 1;
		this.#durableLobbyEmittedKey = null;
		this.#stopLiveLobbyHeartbeat();
		this.#publishedJoinedKey = null;
		this.#publishedStartedKey = null;
		this.#replayNameAttachKey = null;
		this.game.isIngame = false;
		this.lobby = null;
		this.database.lobbiesLive
			.removeLobby()
			.catch((error) => console.warn('[APP]: lobbies_live cleanup on game exit failed:', error));
	}

	/** Returns true when this match has not yet published the given lobby event. */
	#claimLobbyPublish(kind: 'joined' | 'started', lobby: Lobby): boolean {
		const key = lobbyPublishKey(lobby);

		if (!key) {
			return true;
		}

		if (kind === 'joined') {
			if (this.#publishedJoinedKey === key) {
				return false;
			}

			this.#publishedJoinedKey = key;
			return true;
		}

		if (this.#publishedStartedKey === key) {
			return false;
		}

		this.#publishedStartedKey = key;
		return true;
	}

	/**
	 * Exports the full settings tree (including feature settings and account)
	 * as a versioned envelope to a user-chosen file.
	 */
	async exportSettings(): Promise<void> {
		try {
			const path = await save({
				defaultPath: await join(await this.paths.documentDir(), 'fknoobs-settings.json'),
				title: t('Export Settings'),
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (!path) {
				return;
			}

			const envelope = createEnvelope(settings.snapshot(), this.version);
			await writeTextFile(path, serializeEnvelope(envelope));

			this.toast.success(t('Settings exported successfully.'));
		} catch (error) {
			console.error('[APP]: Failed to export settings:', error);
			this.toast.error(t('Failed to export settings. Please try again.'));
		}
	}

	/**
	 * Imports settings from a file. Validates first, then applies live (no
	 * restart needed). A pre-import backup is written automatically.
	 */
	async importSettings(): Promise<void> {
		try {
			const path = await open({
				title: t('Import Settings'),
				multiple: false,
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (!path || Array.isArray(path)) {
				return;
			}

			const content = await readTextFile(path);
			const parsed = parseImportContent(content);

			if (!parsed.success) {
				this.toast.error(t('Import rejected: {message}', { message: parsed.error }));
				return;
			}

			const result = await settings.replace(parsed.data);

			if (!result.success) {
				this.toast.error(t('Import rejected: {message}', { message: result.error }));
				return;
			}

			this.toast.success(t('Settings imported and applied.'));

			// Imported paths may be invalid on this machine: send the user
			// through the setup wizard instead of failing silently.
			if (!(await this.isConfigured())) {
				await goto('/setup');
			}
		} catch (error) {
			console.error('[APP]: Failed to import settings:', error);
			this.toast.error(t('Failed to import settings. Please try again.'));
		}
	}
}

export const app = new AppContext();
