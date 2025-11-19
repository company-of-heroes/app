import { getFactionFlagFromRace, Race } from '$lib/utils';
import { createRawSnippet } from 'svelte';

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
};

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
 * Cache for storing map image imports to avoid repeated dynamic imports
 * Maps map name to the imported image path
 */
const mapCache = new Map<string, string>();

/**
 * Gets the map image based on map name with caching and fallback
 * Dynamically imports map images and provides error handling
 *
 * @param mapName - Name of the map to get image for
 * @returns Promise resolving to the map image asset path
 */
export async function getMapImageFromName(mapName: string): Promise<string> {
	mapName = mapName.toLowerCase();

	// Return cached result if available
	if (mapCache.has(mapName)) {
		return mapCache.get(mapName)!;
	}

	// Handle empty or invalid map name
	if (!mapName || typeof mapName !== 'string') {
		const defaultMap = await import(`$lib/files/maps/mp_nobattlemap.png`);
		const result = defaultMap.default;
		mapCache.set('', result);
		return result;
	}

	try {
		const mapImage = await import(`$lib/files/maps/${mapName}_map_base.png`);
		const result = mapImage.default;
		if (result) {
			mapCache.set(mapName, result);
			return result;
		}
		throw new Error('Map image not found');
	} catch (error) {
		console.warn(`Failed to load map image for "${mapName}":`, error);
		const defaultMap = await import(`$lib/files/maps/mp_nobattlemap.png`);
		const result = defaultMap.default;

		mapCache.set(mapName, result);
		return result;
	}
}
