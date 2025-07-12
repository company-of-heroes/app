import EventEmitter from 'eventemitter3';
import { RelicProfile } from '../types';
import { server } from '../server';
import { Lobby } from './lobby';

/**
 * Union type representing all available Company of Heroes maps.
 * Includes 2-player, 4-player, 6-player, and 8-player maps.
 */
export type CoHMaps =
	| '2p_angoville farms'
	| '2p_beach_assault'
	| '2p_beaux lowlands'
	| '2p_bernieres-sur-mer'
	| '2p_best'
	| '2p_carpiquet'
	| '2p_circle_wall'
	| '2p_flooded_plains'
	| '2p_langres'
	| '2p_lyon'
	| '2p_semois'
	| '2p_st_mere_dumont'
	| '2p_sturzdorf'
	| '2p_verrieres_ridge'
	| '2p_verrieres_ridge_no_bunkers'
	| '2p_wrecked_train'
	| '2p_duclair'
	| '2p_egletons'
	| '2p_industrial riverbed'
	| '2p_ruins of rouen'
	| '4p_alsace moselle'
	| '4p_duclair'
	| '4p_road to montherme'
	| '6p_red_ball_express'
	| '6p_vimoutiers'
	| '4p_achelous river'
	| '4p_bedum'
	| '4p_coastal_harbour'
	| '4p_ecliptic fields'
	| '4p_etavaux'
	| '4p_linden'
	| '4p_lorraine'
	| '4p_lyon'
	| '4p_mcgechaens war'
	| '4p_point_du_hoc'
	| '4p_rails and metal'
	| '4p_st hilaire'
	| '4p_vire river valley'
	| '4p_wolfheze'
	| '6p_close_river_combat'
	| '6p_drekplaats'
	| '6p_hedgerow_siege'
	| '6p_hill 331'
	| '6p_montherme'
	| '6p_refinery'
	| '6p_seine_river_docks'
	| '6p_villers_bocage'
	| '8p_best'
	| '8p_king_of_the_hill'
	| '8p_montargis region'
	| '8p_route_n13'
	| '8p_steel_pact';

/**
 * Event types that can be emitted by the Game class.
 * Used for notifying listeners about game state changes.
 */
export type GameEvents = {
	'GAME:LAUNCHED': (game: Game) => void;
	'GAME:CLOSED': () => void;
	'LOBBY:STARTED': (lobby: Lobby) => void;
	'LOBBY:ENDED': (lobby: Lobby) => void;
};

/**
 * Represents a Company of Heroes game instance and manages game state.
 * Extends EventEmitter to emit game-related events.
 */
export class Game extends EventEmitter<GameEvents> {
	/**
	 * Whether the game is currently running.
	 *
	 * @type {boolean}
	 * @private
	 */
	private isRunning: boolean = false;

	/**
	 * The Steam ID of the current player.
	 *
	 * @type {string | BigInt | null}
	 * @private
	 */
	private steamId: string | BigInt | null = null;

	/**
	 * The Relic profile of the current player.
	 *
	 * @type {RelicProfile | null}
	 * @private
	 */
	private profile: RelicProfile | null = null;

	/**
	 * The current lobby instance.
	 *
	 * @type {Lobby}
	 * @private
	 */
	private lobby: Lobby = new Lobby();

	/**
	 * Game constructor.
	 * Sets up event listeners for game and lobby events.
	 */
	constructor() {
		super();

		this.addListener('GAME:LAUNCHED', () => {
			server.publish('game', JSON.stringify({ type: 'GAME:LAUNCHED', data: this.toJSON() }));
		});

		this.addListener('LOBBY:STARTED', () => {
			server.publish('game', JSON.stringify({ type: 'LOBBY:STARTED', data: this.lobby.toJSON() }));
		});

		this.addListener('LOBBY:ENDED', () => {
			server.publish('game', JSON.stringify({ type: 'LOBBY:ENDED', data: this.lobby.toJSON() }));
		});

		this.addListener('GAME:CLOSED', () => {
			server.publish('game', JSON.stringify({ type: 'GAME:CLOSED', data: this.toJSON() }));
		});
	}

	/**
	 * Sets the Relic profile for the current player.
	 *
	 * @param {RelicProfile} profile - The Relic profile to set
	 */
	setProfile(profile: RelicProfile) {
		this.profile = profile;
	}

	/**
	 * Gets the current Relic profile.
	 *
	 * @returns {RelicProfile | null} The current profile or null if not set
	 */
	getProfile(): RelicProfile | null {
		return this.profile;
	}

	/**
	 * Gets a specific property from the current Relic profile.
	 *
	 * @template K - The key type from RelicProfile
	 * @param {K} key - The property key to retrieve
	 * @returns {RelicProfile[K] | null} The property value or null if profile not set
	 */
	getProfileProperty<K extends keyof RelicProfile>(key: K): RelicProfile[K] | null {
		if (!this.profile) {
			return null;
		}

		return this.profile[key];
	}

	/**
	 * Sets the running state of the game.
	 *
	 * @param {boolean} isRunning - Whether the game is running
	 */
	setIsRunning(isRunning: boolean) {
		this.isRunning = isRunning;
	}

	/**
	 * Gets the running state of the game.
	 *
	 * @returns {boolean} Whether the game is currently running
	 */
	getIsRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Sets the Steam ID for the current player.
	 *
	 * @param {string | BigInt} steamId - The Steam ID to set
	 */
	setSteamId(steamId: string | BigInt) {
		this.steamId = steamId;
	}

	/**
	 * Gets the Steam ID of the current player.
	 *
	 * @returns {string | BigInt | null} The Steam ID or null if not set
	 */
	getSteamId(): string | BigInt | null {
		return this.steamId;
	}

	/**
	 * Sets the current lobby instance.
	 *
	 * @param {Lobby} lobby - The lobby instance to set
	 */
	setLobby(lobby: Lobby) {
		this.lobby = lobby;
	}

	/**
	 * Gets the current lobby instance.
	 *
	 * @returns {Lobby} The current lobby
	 */
	getLobby(): Lobby {
		return this.lobby;
	}

	/**
	 * Converts the game instance to a JSON representation.
	 * Includes running state, profile, and Steam ID.
	 *
	 * @returns {object} JSON representation of the game state
	 */
	toJSON() {
		return {
			isRunning: this.isRunning,
			profile: this.profile,
			steamId: this.steamId?.toString()
		};
	}
}
