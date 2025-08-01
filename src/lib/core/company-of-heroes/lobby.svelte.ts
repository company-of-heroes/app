import type { LobbyPlayer } from '@fknoobs/app';
import { app } from '$core/app/app.svelte';
import { getRacePrefix } from '$lib/utils';
import { groupBy } from 'lodash-es';

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
export const LEADERBOARD_IDS = {
	'1v1_us': 4,
	'1v1_heer': 5,
	'1v1_brit': 6,
	'1v1_panzer': 7,
	'2v2_us': 8,
	'2v2_heer': 9,
	'2v2_brit': 10,
	'2v2_panzer': 11,
	'3v3_us': 12,
	'3v3_heer': 13,
	'3v3_brit': 14,
	'3v3_panzer': 15,
	'4v4_us': 16,
	'4v4_heer': 17,
	'4v4_brit': 18,
	'4v4_panzer': 19
};

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
	 * Unique session ID for the lobby.
	 *
	 * @public
	 * @type {number | null}
	 */
	sessionId: number | null = null;
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
	players = $state<LobbyPlayer[]>([]);

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
	matchType = $derived.by(() => {
		if (!this.isRanked) {
			return 0;
		}

		if (this.players.length === 2) {
			return 1;
		}

		if (this.players.length === 4) {
			return 2;
		}

		if (this.players.length === 6) {
			return 3;
		}

		if (this.players.length === 8) {
			return 4;
		}

		return 0;
	});

	/**
	 * Derived state indicating whether this is a ranked match.
	 * Ranked matches are those with match types 1-7 (1v1 through 4v4 AT).
	 *
	 * @public
	 * @readonly
	 * @type {boolean}
	 */
	isRanked = $derived.by(() => {
		const hasRankedPlayers = this.players.some((player) => player.ranking && player.ranking > 0);

		if (hasRankedPlayers) {
			return true;
		}

		return false;
	});

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
	 * Adds a new player to the lobby.
	 * Ensures no duplicate players are added based on their index.
	 *
	 * @public
	 * @param {LobbyPlayer} player - The player to add to the lobby
	 */
	addPlayer(player: LobbyPlayer) {
		if (this.players.some((p) => p.index === player.index)) {
			return;
		}

		this.players.push(player);
	}

	/**
	 * Retrieves a player by their slot number.
	 * Maps slot numbers to player indices based on the lobby size.
	 *
	 * @public
	 * @param {number} slot - The slot number to find the player for
	 * @returns {LobbyPlayer | null} The player in the specified slot, or null if not found
	 */
	getPlayerBySlot(slot: number) {
		const mappings: Record<number, number[]> = {
			8: [0, 2, 4, 6, 1, 3, 5, 7],
			6: [0, 2, 4, 1, 3, 5],
			4: [0, 2, 1, 3],
			2: [0, 1]
		};

		const mapping = mappings[this.players.length];

		if (!mapping) {
			return null;
		}

		const index = mapping.indexOf(slot);

		if (index === -1) {
			return null;
		}

		return this.players.find((player) => player.index === index)!;
	}

	/**
	 * Converts the lobby state to a JSON object.
	 * Useful for serialization or sending over a network.
	 *
	 * @public
	 * @returns {object} JSON representation of the lobby
	 */
	getPlayerIds(): number[] {
		return this.players.map((player) => player.playerId).filter((id) => id !== -1);
	}

	/**
	 * Retrieves a player by their profile ID.
	 * Useful for finding players based on their unique identifiers.
	 *
	 * @public
	 * @param {number} playerId - The profile ID of the player to find
	 * @returns {LobbyPlayer | undefined} The player with the specified ID, or undefined if not found
	 */
	getPlayerById(playerId: number): LobbyPlayer | undefined {
		return this.players.find((player) => player.playerId === playerId);
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

	toJSON() {
		return {
			sessionId: this.sessionId,
			isRanked: this.isRanked,
			map: this.map,
			players: this.players.map((player) => ({
				...player
			})),
			outcome: this.outcome,
			matchType: this.matchType,
			teams: this.teams,
			type: this.type,
			mapName: this.mapName,
			me: this.me ? { ...this.me } : undefined
		};
	}
}
