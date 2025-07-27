import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import WMFlag from '$lib/files/wm.png';
import PEFlag from '$lib/files/pe.png';
import CWFlag from '$lib/files/cw.png';
import USFlag from '$lib/files/us.png';
import { isBoolean, isString } from 'lodash-es';

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
export function getFactionFlagFromRace(
	race: Race | number | 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
): string {
	switch (race) {
		case Race.US:
		case 'allies':
			return USFlag;
		case Race.Wehrmacht:
		case 'axis':
			return WMFlag;
		case Race.Commonwealth:
		case 'allies_commonwealth':
			return CWFlag;
		case Race.PanzerElite:
		case 'axis_panzer_elite':
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
	const match = mapName.match(/^(\d+)p_(.+)$/);
	if (!match) {
		return mapName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

	return `${formattedName} (${playerCount})`;
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

/**
 * Checks if a value is a BigInt
 *
 * @param value - any value to check
 * @returns {boolean} True if the value is a BigInt, false otherwise
 */
export function isBigInt(value: any): value is bigint {
	try {
		return BigInt(parseInt(value, 10)) !== BigInt(value);
	} catch (e) {
		return false;
	}
}

/**
 * Checks if a value is a boolean
 *
 * @param value - any value to check
 * @returns {boolean} True if the value is a boolean, false otherwise
 */
export function isNumeric(str: any) {
	return !isNaN(parseFloat(str)) && isFinite(str);
}

/**
 * Checks if a value is a string
 *
 * @param value - any value to check
 * @returns {boolean} True if the value is a string, false otherwise
 */
export function convertToType(value: any) {
	if (isBigInt(value)) return BigInt(value);
	if (isNumeric(value)) return Number(value);
	if (isBoolean(value)) return Boolean(value);
	if (isString(value)) return String(value);
	return value;
}

/**
 * Infers types from an object, converting values to appropriate types
 *
 * @param data - Object with values to infer types from
 * @returns {object} New object with values converted to inferred types
 */
export function inferTypes(data: object) {
	return Object.keys(data).reduce(
		(acc, key) => ({
			...acc,
			// @ts-ignore
			[key]: convertToType(data[key])
		}),
		{}
	);
}

/**
 * Generates a MD5 hash for a given input string
 *
 * @param {string} input - The input string to hash
 * @returns {string} MD5 hash of the input string in lowercase
 */
export const md5 = (input: string): string => {
	function rotateLeft(x: number, c: number): number {
		return (x << c) | (x >>> (32 - c));
	}

	function addUnsigned(x: number, y: number): number {
		const lsw = (x & 0xffff) + (y & 0xffff);
		const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
		return (msw << 16) | (lsw & 0xffff);
	}

	function F(x: number, y: number, z: number): number {
		return (x & y) | (~x & z);
	}

	function G(x: number, y: number, z: number): number {
		return (x & z) | (y & ~z);
	}

	function H(x: number, y: number, z: number): number {
		return x ^ y ^ z;
	}

	function I(x: number, y: number, z: number): number {
		return y ^ (x | ~z);
	}

	function transform(
		func: (x: number, y: number, z: number) => number,
		a: number,
		b: number,
		c: number,
		d: number,
		x: number,
		s: number,
		ac: number
	): number {
		a = addUnsigned(a, addUnsigned(func(b, c, d), addUnsigned(x, ac)));
		return addUnsigned(rotateLeft(a, s), b);
	}

	function toWordArray(str: string): number[] {
		const msg = unescape(encodeURIComponent(str));
		const len = msg.length;
		const words: number[] = [];

		for (let i = 0; i < len; i++) {
			const wordIndex = i >> 2;
			words[wordIndex] = words[wordIndex] || 0;
			words[wordIndex] |= msg.charCodeAt(i) << ((i % 4) * 8);
		}

		// padding
		const wordIndex = len >> 2;
		words[wordIndex] = words[wordIndex] || 0;
		words[wordIndex] |= 0x80 << ((len % 4) * 8);
		words[((len + 8) >> 6) * 16 + 14] = len * 8;

		return words;
	}

	function toHex(val: number): string {
		let hex = '';
		for (let i = 0; i <= 3; i++) {
			const byte = (val >>> (i * 8)) & 255;
			hex += ('0' + byte.toString(16)).slice(-2);
		}
		return hex;
	}

	const x = toWordArray(input);

	let a = 0x67452301;
	let b = 0xefcdab89;
	let c = 0x98badcfe;
	let d = 0x10325476;

	const S = {
		FF: [7, 12, 17, 22],
		GG: [5, 9, 14, 20],
		HH: [4, 11, 16, 23],
		II: [6, 10, 15, 21]
	};

	const T = new Array(64).fill(0).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));

	for (let i = 0; i < x.length; i += 16) {
		const [aa, bb, cc, dd] = [a, b, c, d];

		// Round 1
		for (let j = 0; j < 16; j++) {
			const s = S.FF[j % 4];
			a = transform(F, a, b, c, d, x[i + j], s, T[j]);
			[a, b, c, d] = [d, a, b, c];
		}

		// Round 2
		for (let j = 0; j < 16; j++) {
			const s = S.GG[j % 4];
			const k = (1 + 5 * j) % 16;
			a = transform(G, a, b, c, d, x[i + k], s, T[16 + j]);
			[a, b, c, d] = [d, a, b, c];
		}

		// Round 3
		for (let j = 0; j < 16; j++) {
			const s = S.HH[j % 4];
			const k = (5 + 3 * j) % 16;
			a = transform(H, a, b, c, d, x[i + k], s, T[32 + j]);
			[a, b, c, d] = [d, a, b, c];
		}

		// Round 4
		for (let j = 0; j < 16; j++) {
			const s = S.II[j % 4];
			const k = (7 * j) % 16;
			a = transform(I, a, b, c, d, x[i + k], s, T[48 + j]);
			[a, b, c, d] = [d, a, b, c];
		}

		a = addUnsigned(a, aa);
		b = addUnsigned(b, bb);
		c = addUnsigned(c, cc);
		d = addUnsigned(d, dd);
	}

	return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
};

/**
 * Converts seconds to a formatted timestamp string (mm:ss or hh:mm:ss)
 *
 * @param seconds - Number of seconds to convert
 * @returns Formatted timestamp string in mm:ss format (or hh:mm:ss if >= 1 hour)
 */
export function secondsToTimestamp(seconds: number): string {
	if (!isNumeric(seconds) || seconds < 0) {
		return '00:00';
	}

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	if (hours > 0) {
		return [hours, minutes, remainingSeconds]
			.map((num) => num.toString().padStart(2, '0'))
			.join(':');
	}

	return [minutes, remainingSeconds].map((num) => num.toString().padStart(2, '0')).join(':');
}
