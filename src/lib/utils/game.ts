import { getFactionFlagFromRace } from '$lib/utils';
import type { LeaderboardStat, LobbyPlayer } from '@fknoobs/app';
import { createRawSnippet } from 'svelte';

/**
 * Race enum for Company of Heroes factions
 * Provides type safety and clear mapping for faction identifiers
 */
export enum Race {
	US = 0,
	Wehrmacht = 1,
	Commonwealth = 2,
	PanzerElite = 3
}

/**
 * Match type constants mapping numeric IDs to human-readable names.
 * Covers all available Company of Heroes match types including ranked and unranked modes.
 *
 * @readonly
 * @private
 * @static
 */
export const MATCH_TYPES = {
	0: 'Basic Match',
	1: '1 VS. 1',
	2: '2 VS. 2',
	3: '3 VS. 3',
	4: '4 VS. 4',
	5: '2 VS. 2 AT',
	6: '3 VS. 3 AT',
	7: '4 VS. 4 AT',
	8: 'Operation: Assault 2v2',
	9: 'Operation: Assault 2v2 AT',
	10: 'Operation: Assault 3v3 AT',
	11: 'Operation: Panzerkrieg 2v2',
	12: 'Operation: Panzerkrieg 2v2 AT',
	13: 'Operation: Panzerkrieg 3v3 AT',
	14: 'Skirmish',
	15: 'Operation: Assault',
	16: 'Operation: Panzerkrieg',
	17: 'Operation: Stonewall'
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
	'4v4_panzer': 19,
	basic_usa: 0,
	basic_wehrmacht: 1,
	basic_british: 2,
	basic_panzer_elite: 3,
	skirmish_usa: 42,
	skirmish_wehrmacht: 43,
	skirmish_british: 44,
	skirmish_panzer_elite: 45,
	operation_stonewall_usa: 54,
	operation_stonewall_wehrmacht: 55,
	operation_assault_usa: 46,
	operation_assault_wehrmacht: 47,
	operation_panzerkrieg_usa: 50,
	operation_panzerkrieg_wehrmacht: 51
} as const;

/**
 * Type for valid leaderboard keys combining match type and faction.
 * Ensures type safety when accessing leaderboard IDs.
 */
export type LeaderboardKey = keyof typeof LEADERBOARD_IDS;

/**
 * Type for valid match type IDs.
 * Provides compile-time checking for match type assignments.
 */
export type MatchTypeId = keyof typeof MATCH_TYPES;

export const isRanked = (leaderboardId: number): boolean => {
	return leaderboardId >= 4 && leaderboardId <= 19;
};

export const getLeaderboardType = (leaderboardId: number): string => {
	const typeMap: Record<number, string> = {
		4: '1 VS. 1',
		5: '1 VS. 1',
		6: '1 VS. 1',
		7: '1 VS. 1',
		8: '2 VS. 2',
		9: '2 VS. 2',
		10: '2 VS. 2',
		11: '2 VS. 2',
		12: '3 VS. 3',
		13: '3 VS. 3',
		14: '3 VS. 3',
		15: '3 VS. 3',
		16: '4 VS. 4',
		17: '4 VS. 4',
		18: '4 VS. 4',
		19: '4 VS. 4',
		0: 'Basic Match',
		1: 'Basic Match',
		2: 'Basic Match',
		3: 'Basic Match',
		42: 'Skirmish',
		43: 'Skirmish',
		44: 'Skirmish',
		45: 'Skirmish',
		54: 'Operation: Stonewall',
		55: 'Operation: Stonewall',
		46: 'Operation: Assault',
		47: 'Operation: Assault',
		50: 'Operation: Panzerkrieg',
		51: 'Operation: Panzerkrieg'
	};
	return typeMap[leaderboardId] || 'Unknown';
};

export function getFactionFlagFromLeaderboardId(leaderboardId: number): string {
	const leaderboardRaceMap: Record<number, Race> = {
		4: Race.US,
		8: Race.US,
		12: Race.US,
		16: Race.US,
		5: Race.Wehrmacht,
		9: Race.Wehrmacht,
		13: Race.Wehrmacht,
		17: Race.Wehrmacht,
		6: Race.Commonwealth,
		10: Race.Commonwealth,
		14: Race.Commonwealth,
		18: Race.Commonwealth,
		7: Race.PanzerElite,
		11: Race.PanzerElite,
		15: Race.PanzerElite,
		19: Race.PanzerElite,
		0: Race.US,
		1: Race.Wehrmacht,
		2: Race.Commonwealth,
		3: Race.PanzerElite,
		42: Race.US,
		43: Race.Wehrmacht,
		44: Race.Commonwealth,
		45: Race.PanzerElite,
		54: Race.US,
		55: Race.Wehrmacht,
		46: Race.US,
		47: Race.Wehrmacht,
		50: Race.US,
		51: Race.Wehrmacht
	};
	const race = leaderboardRaceMap[leaderboardId];
	return getFactionFlagFromRace(race);
}

/**
 * Retrieves the race associated with a given leaderboard ID.
 *
 * @param {number} leaderboardId - The ID of the leaderboard.
 * @returns {Race} - The race corresponding to the leaderboard ID.
 */
export const getRaceFromLeaderboardId = (leaderboardId: number): Race => {
	const leaderboardRaceMap: Record<number, Race> = {
		4: Race.US,
		8: Race.US,
		12: Race.US,
		16: Race.US,
		5: Race.Wehrmacht,
		9: Race.Wehrmacht,
		13: Race.Wehrmacht,
		17: Race.Wehrmacht,
		6: Race.Commonwealth,
		10: Race.Commonwealth,
		14: Race.Commonwealth,
		18: Race.Commonwealth,
		7: Race.PanzerElite,
		11: Race.PanzerElite,
		15: Race.PanzerElite,
		19: Race.PanzerElite,
		0: Race.US,
		1: Race.Wehrmacht,
		2: Race.Commonwealth,
		3: Race.PanzerElite,
		42: Race.US,
		43: Race.Wehrmacht,
		44: Race.Commonwealth,
		45: Race.PanzerElite,
		54: Race.US,
		55: Race.Wehrmacht,
		46: Race.US,
		47: Race.Wehrmacht,
		50: Race.US,
		51: Race.Wehrmacht
	};
	return leaderboardRaceMap[leaderboardId];
};

export const leaderboards = [
	{
		label: '1v1',
		value: '4',
		leaderboardFationIds: [
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border border-black" />`
				})),
				value: '4'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border border-black" />`
				})),
				value: '6'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border border-black" />`
				})),
				value: '5'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(3)}" alt="Panzer Elite" class="w-7 border border-black" />`
				})),
				value: '7'
			}
		]
	},
	{
		label: '2v2',
		value: '8',
		leaderboardFationIds: [
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border border-black" />`
				})),
				value: '8'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border border-black" />`
				})),
				value: '10'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border border-black" />`
				})),
				value: '9'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(3)}" alt="Panzer Elite" class="w-7 border border-black" />`
				})),
				value: '11'
			}
		]
	},
	{
		label: '3v3',
		value: '12',
		leaderboardFationIds: [
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border border-black" />`
				})),
				value: '12'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border border-black" />`
				})),
				value: '14'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border border-black" />`
				})),
				value: '13'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(3)}" alt="Panzer Elite" class="w-7 border border-black" />`
				})),
				value: '15'
			}
		]
	},
	{
		label: '4v4',
		value: '16',
		leaderboardFationIds: [
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border border-black" />`
				})),
				value: '16'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border border-black" />`
				})),
				value: '18'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border border-black" />`
				})),
				value: '17'
			},
			{
				label: createRawSnippet(() => ({
					render: () =>
						`<img src="${getFactionFlagFromRace(3)}" alt="Panzer Elite" class="w-7 border border-black" />`
				})),
				value: '19'
			}
		]
	}
];

/**
 * Eagerly import all map images using Vite's glob import
 * This loads all maps at once during build/initial load for instant access
 */
const mapModules = import.meta.glob<{ default: string }>('$lib/files/maps/*_map_base.png', {
	eager: true
});

/**
 * Cache for storing map image imports to avoid repeated lookups
 * Maps map name to the imported image path
 */
const mapCache = new Map<string, string>();

/**
 * Default fallback map image
 */
let defaultMapImage: string | null = null;

/**
 * Initialize map cache from glob imports
 */
function initializeMapCache() {
	if (mapCache.size > 0) return; // Already initialized

	for (const [path, module] of Object.entries(mapModules)) {
		// Extract map name from path: /src/lib/files/maps/4p_duclair_map_base.png -> 4p_duclair
		const match = path.match(/\/maps\/(.+)_map_base\.png$/);
		if (match) {
			const mapName = match[1].toLowerCase();
			mapCache.set(mapName, module.default);
		}
	}

	// Load default map
	import('$lib/files/maps/mp_nobattlemap.png').then((module) => {
		defaultMapImage = module.default;
	});
}

// Initialize on module load
initializeMapCache();

/**
 * Gets the map image based on map name with instant lookup from pre-loaded cache
 * No dynamic imports needed - all maps are loaded eagerly at startup
 *
 * @param mapName - Name of the map to get image for
 * @returns The map image asset path
 */
export function getMapImageFromName(mapName: string): string {
	console.time('getMapImageFromName ' + mapName);
	if (!mapName || typeof mapName !== 'string') {
		return defaultMapImage || '';
	}

	const normalizedName = mapName.toLowerCase();
	const cachedMap = mapCache.get(normalizedName);

	if (cachedMap) {
		return cachedMap;
	}

	console.warn(`Map image not found for "${mapName}"`);
	return defaultMapImage || '';
}

/**
 * Gets the leaderboard stats for a player based on match type
 *
 * @param matchType - The match type key
 * @param player - The lobby player object
 * @returns The leaderboard stats for the player
 */
export const getLeaderboardStatsForPlayerByMatchType = (
	matchType: keyof typeof MATCH_TYPES,
	player: LobbyPlayer
): LeaderboardStat | undefined => {
	const matchTypeName = MATCH_TYPES[matchType];
	const { race } = player;

	// Map of match types to their race-based leaderboard IDs
	const matchTypeToLeaderboards: Record<string, Record<Race, number>> = {
		'Basic Match': {
			[Race.US]: LEADERBOARD_IDS.basic_usa,
			[Race.Wehrmacht]: LEADERBOARD_IDS.basic_wehrmacht,
			[Race.Commonwealth]: LEADERBOARD_IDS.basic_british,
			[Race.PanzerElite]: LEADERBOARD_IDS.basic_panzer_elite
		},
		'1 VS. 1': {
			[Race.US]: LEADERBOARD_IDS['1v1_us'],
			[Race.Wehrmacht]: LEADERBOARD_IDS['1v1_heer'],
			[Race.Commonwealth]: LEADERBOARD_IDS['1v1_brit'],
			[Race.PanzerElite]: LEADERBOARD_IDS['1v1_panzer']
		},
		'2 VS. 2': {
			[Race.US]: LEADERBOARD_IDS['2v2_us'],
			[Race.Wehrmacht]: LEADERBOARD_IDS['2v2_heer'],
			[Race.Commonwealth]: LEADERBOARD_IDS['2v2_brit'],
			[Race.PanzerElite]: LEADERBOARD_IDS['2v2_panzer']
		},
		'3 VS. 3': {
			[Race.US]: LEADERBOARD_IDS['3v3_us'],
			[Race.Wehrmacht]: LEADERBOARD_IDS['3v3_heer'],
			[Race.Commonwealth]: LEADERBOARD_IDS['3v3_brit'],
			[Race.PanzerElite]: LEADERBOARD_IDS['3v3_panzer']
		},
		'4 VS. 4': {
			[Race.US]: LEADERBOARD_IDS['4v4_us'],
			[Race.Wehrmacht]: LEADERBOARD_IDS['4v4_heer'],
			[Race.Commonwealth]: LEADERBOARD_IDS['4v4_brit'],
			[Race.PanzerElite]: LEADERBOARD_IDS['4v4_panzer']
		},
		Skirmish: {
			[Race.US]: LEADERBOARD_IDS.skirmish_usa,
			[Race.Wehrmacht]: LEADERBOARD_IDS.skirmish_wehrmacht,
			[Race.Commonwealth]: LEADERBOARD_IDS.skirmish_british,
			[Race.PanzerElite]: LEADERBOARD_IDS.skirmish_panzer_elite
		},
		'Operation: Assault': {
			[Race.US]: LEADERBOARD_IDS.operation_assault_usa,
			[Race.Wehrmacht]: LEADERBOARD_IDS.operation_assault_wehrmacht,
			[Race.Commonwealth]: LEADERBOARD_IDS.operation_assault_usa,
			[Race.PanzerElite]: LEADERBOARD_IDS.operation_assault_wehrmacht
		},
		'Operation: Panzerkrieg': {
			[Race.US]: LEADERBOARD_IDS.operation_panzerkrieg_usa,
			[Race.Wehrmacht]: LEADERBOARD_IDS.operation_panzerkrieg_wehrmacht,
			[Race.Commonwealth]: LEADERBOARD_IDS.operation_panzerkrieg_usa,
			[Race.PanzerElite]: LEADERBOARD_IDS.operation_panzerkrieg_wehrmacht
		},
		'Operation: Stonewall': {
			[Race.US]: LEADERBOARD_IDS.operation_stonewall_usa,
			[Race.Wehrmacht]: LEADERBOARD_IDS.operation_stonewall_wehrmacht,
			[Race.Commonwealth]: LEADERBOARD_IDS.operation_stonewall_usa,
			[Race.PanzerElite]: LEADERBOARD_IDS.operation_stonewall_wehrmacht
		}
	};

	// Handle AT (Arranged Team) variants by mapping to base match type
	const normalizedMatchType = matchTypeName.replace(' AT', '');
	const leaderboardMap = matchTypeToLeaderboards[normalizedMatchType];
	const leaderboardId = leaderboardMap?.[race as Race];

	return player.profile?.leaderboardStats?.find((stat) => stat.leaderboard_id === leaderboardId);
};
