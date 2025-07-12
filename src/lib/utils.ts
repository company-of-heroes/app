import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import WMFlag from '$lib/files/wm.png';
import PEFlag from '$lib/files/pe.png';
import CWFlag from '$lib/files/cw.png';
import USFlag from '$lib/files/us.png';

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
 * Utility function for merging CSS classes using clsx and tailwind-merge
 * Combines multiple class values and resolves Tailwind CSS conflicts
 *
 * @param inputs - Variable number of class values (strings, objects, arrays, etc.)
 * @returns Merged and optimized class string
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Extracts Steam ID from a player name string
 * Handles Steam profile paths and returns the ID portion
 *
 * @param name - Player name string containing Steam path
 * @returns Steam ID string or empty string if not found
 */
export function getSteamIdFromName(name: string): string {
	if (!name || typeof name !== 'string') {
		return '';
	}

	const match = name.match(/\/steam\/([^/]+)/);
	return match?.[1] ?? '';
}

/**
 * Gets the faction flag image based on race
 * Returns the appropriate flag asset for each Company of Heroes faction
 *
 * @param race - Race enum value or number (0-3)
 * @returns Flag image asset path
 */
export function getFactionFlagFromRace(race: Race | number): string {
	switch (race) {
		case Race.US:
			return USFlag;
		case Race.Wehrmacht:
			return WMFlag;
		case Race.Commonwealth:
			return CWFlag;
		case Race.PanzerElite:
			return PEFlag;
		default:
			return USFlag; // Default fallback
	}
}

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
		console.log(defaultMap);
		mapCache.set(mapName, result);
		return result;
	}
}

/**
 * Cache for storing rank image imports to avoid repeated dynamic imports
 * Maps race-rank combination to the imported image path
 */
const rankCache = new Map<string, string>();

/**
 * Gets the rank image based on race and rank with caching and fallback
 * Dynamically imports rank images and provides error handling
 * @param race - Race enum value or number (0-3)
 * @param rank - Optional rank number for the player
 *
 * @returns Promise resolving to the rank image asset path
 */
export async function getRankImage(race: Race | number, rank?: number): Promise<string> {
	const cacheKey = `${race}-${rank}`;

	// Return cached result if available
	if (rankCache.has(cacheKey)) {
		return rankCache.get(cacheKey)!;
	}

	// Validate race parameter
	if (typeof race !== 'number' || race < 0 || race > 3) {
		console.warn(`Invalid race parameter: ${race}`);
		race = Race.US; // Default to US
	}

	// Get race prefix with better mapping
	const racePrefix = getRacePrefix(race);

	// Handle invalid or missing rank
	if (rank === undefined || rank < 0 || !Number.isInteger(rank)) {
		const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
		const result = defaultRankImage.default;
		rankCache.set(cacheKey, result);
		return result;
	}

	try {
		const rankImage = await import(`$lib/files/ranks/${racePrefix}_${rank}.png`);
		const result = rankImage.default;
		if (result) {
			rankCache.set(cacheKey, result);
			return result;
		}
		throw new Error('Rank image not found');
	} catch (error) {
		console.warn(`Failed to load rank image for race ${race}, rank ${rank}:`, error);
		const defaultRankImage = await import(`$lib/files/ranks/no_rank_yet.png`);
		const result = defaultRankImage.default;
		rankCache.set(cacheKey, result);
		return result;
	}
}

export function normalizeMapName(mapName: string): string {
	return mapName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

export function getRacePrefix(race: Race | number): string {
	switch (race) {
		case Race.US:
			return 'us';
		case Race.Wehrmacht:
			return 'heer';
		case Race.Commonwealth:
			return 'brit';
		case Race.PanzerElite:
			return 'panzer';
		default:
			return 'us';
	}
}
