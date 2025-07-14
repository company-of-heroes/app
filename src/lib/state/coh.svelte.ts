import type { RelicProfile, LobbyPlayer } from '@fknoobs/app';
import { invoke } from '@tauri-apps/api/core';
import { watch } from 'runed';
import { groupBy } from 'lodash-es';
import { getRacePrefix, Race } from '$lib/utils';
import Emittery from 'emittery';
import { app } from './app.svelte';

export type GameEvents = {
	'GAME:LAUNCHED': {
		isRunning: boolean;
		steamId: string;
		profile: RelicProfile;
	};
	'GAME:CLOSED': never;
	'LOBBY:STARTED': {
		isStarted: boolean;
		map: string;
		outcome: 'PS_WON' | 'PS_LOST' | 'PS_ABORTED';
		players: LobbyPlayer[];
		matchType: number;
	};
	'LOBBY:GAMEOVER': {
		isStarted: boolean;
		map: string;
		outcome: 'PS_WON' | 'PS_LOST' | 'PS_ABORTED';
		players: LobbyPlayer[];
	};
	'LOBBY:DESTROYED': never;
};

/**
 * Represents a Company of Heroes game instance and manages game state.
 * Tracks game running status, player profile, lobby information, and window focus.
 * Provides reactive state management using Svelte 5 runes.
 */
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
	 * Initializes the Game instance and sets up reactive effects.
	 * Automatically starts/stops window focus tracking based on game running state.
	 *
	 * @constructor
	 */
	constructor() {
		super();

		this.on('GAME:LAUNCHED', (data) => {
			this.isRunning = data.isRunning;
			this.steamId = data.steamId;
			this.profile = data.profile;

			this.trackWindowFocus();
		});

		this.on('GAME:CLOSED', () => {
			this.isRunning = false;
			this.steamId = undefined;
			this.profile = undefined;
			this.lobby = undefined;

			this.stopTrackingWindowFocus();
		});

		this.on('LOBBY:STARTED', (data) => {
			this.lobby = new Lobby(data.map, data.players, data.matchType);
			this.isIngame = true;
		});

		this.on('LOBBY:GAMEOVER', (data) => {
			if (!this.lobby) {
				return;
			}

			this.lobby.outcome = data.outcome;
			this.playedLobbies.push(this.lobby);
		});

		this.on('LOBBY:DESTROYED', () => {
			this.lobby = undefined;
			this.isIngame = false;
		});
	}

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
}

/**
 * Match type constants mapping numeric IDs to human-readable names.
 * Covers all available Company of Heroes match types including ranked and unranked modes.
 *
 * @readonly
 * @private
 * @static
 */
const MATCH_TYPES = {
	0: 'Custom Game',
	1: '1v1',
	2: '2v2',
	3: '3v3',
	4: '4v4',
	5: '2v2 AT',
	6: '3v3 AT',
	7: '4v4 AT',
	8: 'Assault 2v2',
	9: 'Assault 2v2 AT',
	10: 'Assault 3v3 AT',
	11: 'Panzerkrieg 2v2',
	12: 'Panzerkrieg 2v2 AT',
	13: 'Panzerkrieg 3v3 AT',
	14: 'Comp Stomp',
	15: 'Assault',
	16: 'Panzerkrieg',
	17: 'Stonewall'
} as const;

/**
 * Leaderboard ID mapping for different game modes and factions.
 * Used to retrieve rank information for specific mode-faction combinations.
 *
 * @readonly
 * @private
 * @static
 */
const LEADERBOARD_IDS = {
	'1v1_us': 1,
	'1v1_heer': 2,
	'1v1_brit': 3,
	'1v1_panzer': 4,
	'2v2_us': 5,
	'2v2_heer': 6,
	'2v2_brit': 7,
	'2v2_panzer': 8,
	'3v3_us': 9,
	'3v3_heer': 10,
	'3v3_brit': 11,
	'3v3_panzer': 12,
	'4v4_us': 13,
	'4v4_heer': 14,
	'4v4_brit': 15,
	'4v4_panzer': 16
} as const;

/**
 * Type for valid leaderboard keys combining match type and faction.
 * Ensures type safety when accessing leaderboard IDs.
 */
type LeaderboardKey = keyof typeof LEADERBOARD_IDS;

/**
 * Type for valid match type IDs.
 * Provides compile-time checking for match type assignments.
 */
type MatchTypeId = keyof typeof MATCH_TYPES;

/**
 * Cache for storing map image imports to avoid repeated dynamic imports
 * Maps map name to the imported image path
 */
const mapCache = new Map<string, string>();

/**
 * Represents a Company of Heroes lobby instance.
 * Manages lobby state, player information, match details, and ranking data.
 * Provides reactive state management and derived computations using Svelte 5 runes.
 */
export class Lobby {
	/**
	 * Current map name for the lobby.
	 * Set when a lobby is created or updated.
	 *
	 * @public
	 * @type {string | undefined}
	 */
	map = $state<string>();

	/**
	 * Array of players currently in the lobby.
	 * Includes player information, teams, races, and profile data.
	 *
	 * @public
	 * @type {LobbyPlayer[]}
	 */
	players = $state.raw<LobbyPlayer[]>([]);

	/**
	 * Match outcome when the game ends.
	 * Indicates win, loss, or abort status.
	 *
	 * @public
	 * @type {string | undefined}
	 */
	outcome = $state<string>();

	/**
	 * Derived state providing a human-readable outcome string.
	 * Converts match outcome codes to descriptive text.
	 *
	 * @public
	 * @readonly
	 * @type {string}
	 */
	outcomeFormatted = $derived.by(() => {
		if (!this.outcome) return 'Unknown';

		switch (this.outcome) {
			case 'PS_WON':
				return 'Won';
			case 'PS_LOST':
				return 'Lost';
			case 'PS_ABORTED':
				return 'Aborted';
			default:
				return 'Unknown';
		}
	});

	/**
	 * Numeric identifier for the match type.
	 * Used to determine game mode and ranking eligibility.
	 *
	 * @public
	 * @type {number | undefined}
	 */
	matchType = $state<number>();

	/**
	 * Derived state indicating whether this is a ranked match.
	 * Ranked matches are those with match types 1-7 (1v1 through 4v4 AT).
	 *
	 * @public
	 * @readonly
	 * @type {boolean}
	 */
	isRanked = $derived(this.matchType ? this.matchType >= 1 && this.matchType <= 7 : false);

	/**
	 * Derived state organizing players into teams.
	 * Groups players by team ID and provides structured team data.
	 *
	 * @public
	 * @readonly
	 * @type {{ teamId: number; players: LobbyPlayer[] }[]}
	 */
	teams = $derived(
		Object.entries(groupBy(this.players, 'team')).map(([teamId, players]) => ({
			teamId: Number(teamId),
			players
		}))
	);

	/**
	 * Derived state providing human-readable match type name.
	 * Maps numeric match type to descriptive string.
	 *
	 * @public
	 * @readonly
	 * @type {string}
	 */
	type = $derived(MATCH_TYPES[this.matchType as MatchTypeId] ?? 'Custom Game');

	/**
	 * Derived state providing formatted map name with player count.
	 * Extracts and formats map information from the raw map string.
	 *
	 * @public
	 * @readonly
	 * @type {string}
	 */
	mapName = $derived.by(() => {
		if (!this.map) return 'Unknown Map';

		const match = this.map.match(/^(\d+)p_(.+)$/);
		if (!match) {
			return this.map.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		}

		const [, playerCount, mapNameWithoutPrefix] = match;
		const formattedName = mapNameWithoutPrefix
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase());

		return `${formattedName} (${playerCount})`;
	});

	/**
	 * Derived state to find the current player in the lobby.
	 * Searches for the player with the same Steam ID as the app's current game.
	 *
	 * @public
	 * @readonly
	 * @type {LobbyPlayer | undefined}
	 */
	me = $derived.by(() => {
		if (!this.players || this.players.length === 0) return undefined;

		return this.players.find((player) => player.steamId === app.game.steamId);
	});

	constructor(map: string, players: LobbyPlayer[], matchType: number) {
		this.map = map;
		this.players = players;
		this.matchType = matchType;
	}

	/**
	 * Retrieves the appropriate rank image for a given player.
	 * Handles different scenarios including unranked matches, missing data, and rank levels.
	 * Provides fallback images and comprehensive error handling.
	 *
	 * @public
	 * @async
	 * @param {LobbyPlayer} player - The player to get rank image for
	 * @returns {Promise<string>} Promise resolving to the rank image asset path
	 */
	async getRankImage(player: LobbyPlayer): Promise<string> {
		try {
			const racePrefix = getRacePrefix(player.race);

			// Return default image for unranked matches
			if (!this.isRanked) {
				const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
				return defaultRankImage.default;
			}

			// Validate required data for ranked matches
			if (!this.type || !racePrefix) {
				const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
				return defaultRankImage.default;
			}

			// Construct leaderboard key and get ID
			const leaderBoardKey = `${this.type}_${racePrefix}` as LeaderboardKey;
			const leaderBoardId = LEADERBOARD_IDS[leaderBoardKey];

			if (!leaderBoardId) {
				const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
				return defaultRankImage.default;
			}

			// Find player's ranking data for this leaderboard
			const statGroup = player.profile?.leaderboardStats?.find(
				(stat) => stat.leaderboard_id === leaderBoardId
			);

			// Return default image if no ranking data or rank level is 0 or negative
			if (!statGroup || statGroup.ranklevel <= 0) {
				const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
				return defaultRankImage.default;
			}

			// Load specific rank image with zero-padded rank level
			const rankImage = await import(
				`$lib/files/ranks/${racePrefix}_${statGroup.ranklevel.toString().padStart(2, '0')}.png`
			);

			return rankImage.default;
		} catch (error) {
			console.error('Error loading rank image for player:', player, error);

			// Fallback to default image on any error
			try {
				const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
				return defaultRankImage.default;
			} catch (fallbackError) {
				console.error('Critical error: Could not load default rank image:', fallbackError);
				return ''; // Last resort fallback
			}
		}
	}

	async getMapImage(map: string): Promise<string> {
		// Return cached result if available
		if (mapCache.has(map)) {
			return mapCache.get(map)!;
		}

		// Handle empty or invalid map name
		if (!map || typeof map !== 'string') {
			const defaultMap = await import(`$lib/files/maps/mp_nobattlemap.png`);
			const result = defaultMap.default;

			mapCache.set('', result);
			return result;
		}

		try {
			const mapImage = await import(`$lib/files/maps/${map}_map_base.png`);
			const result = mapImage.default;

			if (result) {
				mapCache.set(map, result);
				return result;
			}

			throw new Error('Map image not found');
		} catch (error) {
			const defaultMap = await import(`$lib/files/maps/mp_nobattlemap.png`);
			const result = defaultMap.default;

			mapCache.set(map, result);
			return result;
		}
	}
}
