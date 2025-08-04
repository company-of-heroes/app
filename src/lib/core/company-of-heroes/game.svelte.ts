import type { LobbyPlayer, RelicProfile } from '@fknoobs/app';
import { invoke } from '@tauri-apps/api/core';
import Emittery from 'emittery';
import { Lobby } from './lobby.svelte';

export type GameEvents = {
	'GAME:LAUNCHED': never;
	'GAME:CLOSED': never;
	'LOBBY:STARTED': Lobby;
	'LOBBY:GAMEOVER': never;
	'LOBBY:DESTROYED': never;
};

export class Game extends Emittery<GameEvents> {
	/**
	 * Private interval timer for tracking window focus.
	 * Uses NodeJS.Timeout for proper cleanup on component destruction.
	 *
	 * @private
	 * @type {NodeJS.Timeout | null}
	 */
	#watchWindowFocusInterval: NodeJS.Timeout | null = null;

	/**
	 * Reactive state indicating whether the game is currently running.
	 * Automatically triggers window focus tracking when true.
	 *
	 * @public
	 * @type {boolean}
	 */
	isRunning = $state(false);

	/**
	 * Reactive state indicating whether the game is currently in an ingame state.
	 * This is used to determine if the game is actively being played.
	 *
	 * @public
	 * @type {boolean}
	 */
	isIngame = $state(false);

	/**
	 * Steam ID of the current player.
	 * Set when the game is launched and a profile is loaded.
	 *
	 * @public
	 * @type {string | undefined}
	 */
	steamId = $state<string>();

	/**
	 * Relic profile information for the current player.
	 * Contains player stats, ranking, and leaderboard data.
	 *
	 * @public
	 * @type {RelicProfile | undefined}
	 */
	profile = $state.raw<RelicProfile>();

	/**
	 * Current lobby instance if a game lobby is active.
	 * Contains match information, players, and lobby state.
	 *
	 * @public
	 * @type {Lobby | undefined}
	 */
	lobby = $state.raw<Lobby>();

	/**
	 * All lobbies that have been created during the game session.
	 *
	 * @public
	 * @type {Lobby[]}
	 */
	playedLobbies = $state<Lobby[]>([]);

	/**
	 * Reactive state indicating whether the game window has focus.
	 * Updated periodically when the game is running.
	 *
	 * @public
	 * @type {boolean}
	 */
	isWindowFocused = $state<boolean>(false);

	/**
	 * Tracks whether a notification has been sent for the current game session.
	 * Used to prevent duplicate notifications.
	 *
	 * @public
	 * @type {boolean}
	 */
	didNotify = $state<boolean>(false);

	/**
	 * Starts periodic tracking of window focus status.
	 * Polls the active window title every second to determine if the game has focus.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>}
	 */
	private async trackWindowFocus(): Promise<void> {
		this.#watchWindowFocusInterval = setInterval(() => {
			invoke<string>('get_active_window_title')
				.then((title) => {
					this.isWindowFocused = title.includes('Company Of Heroes');
				})
				.catch((error) => {
					console.error('Error getting active window title:', error);
				});
		}, 1000);
	}

	/**
	 * Stops tracking window focus and cleans up the interval timer.
	 * Called when the game stops running or the instance is destroyed.
	 *
	 * @private
	 * @returns {void}
	 */
	private stopTrackingWindowFocus(): void {
		if (this.#watchWindowFocusInterval) {
			clearInterval(this.#watchWindowFocusInterval);
			this.#watchWindowFocusInterval = null;
		}
	}

	/**
	 * Resets the game state to its initial values.
	 * This is useful for clearing the game state when starting a new game or when the game
	 * is closed.
	 *
	 * @public
	 * @returns {void}
	 */
	reset(): void {
		this.isRunning = false;
		this.isIngame = false;
		this.steamId = '';
		this.profile = undefined;
		this.lobby = undefined;
		this.playedLobbies = [];
		this.isWindowFocused = false;
		this.didNotify = false;
	}
}
