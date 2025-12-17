import { type ClassValue, clsx } from 'clsx';
import type { ChatMessage } from '@twurple/chat';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
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

export function getRankImageByLeaderboardId(leaderboardId: number, rank?: number): Promise<string> {
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
		19: Race.PanzerElite
	};

	const race = leaderboardRaceMap[leaderboardId];
	return getRankImage(race, rank);
}

export function normalizeMapName(mapName: string): string {
	const match = mapName.match(/^(\d+)[pP][ _](.+)$/);
	if (!match) {
		return mapName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.toLowerCase()
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

/**
 * Strips emote substrings from a Twitch chat message based on emote tags
 *
 * @param text - Original chat message text
 * @param msg - ChatMessage object containing emote tag information
 * @returns Message text with emotes removed
 */
export function stripEmotes(text: string, msg: ChatMessage): string {
	// Twurple exposes tags as a Map; use robust access in case of version diffs
	const tagsMap: Map<string, string> | undefined = (msg as any)?.tags;
	const emotesTag: string | undefined = tagsMap?.get?.('emotes');

	if (!emotesTag) {
		// No emotes tagged, return original text
		return text;
	}

	// emotes tag format example: "28087:0-6/25:8-12,14-18"
	const ranges: Array<[number, number]> = [];
	for (const group of emotesTag.split('/')) {
		const [, indices] = group.split(':');
		if (!indices) continue;
		for (const r of indices.split(',')) {
			const [startStr, endStr] = r.split('-');
			const start = Number(startStr);
			const end = Number(endStr);
			if (!Number.isNaN(start) && !Number.isNaN(end)) {
				ranges.push([start, end]);
			}
		}
	}

	if (!ranges.length) {
		return text;
	}

	// Remove from right to left to keep indices valid
	ranges.sort((a, b) => b[0] - a[0]);
	let result = text;
	for (const [start, end] of ranges) {
		result = result.slice(0, start) + result.slice(end + 1);
	}

	// Normalize whitespace and trim
	result = result.replace(/\s{2,}/g, ' ').trim();
	return result;
}

/**
 * Unzips a file to a specified destination directory.
 *
 * @param zipPath - The absolute path to the zip file
 * @param destination - The absolute path to the destination directory
 * @returns A promise that resolves when the extraction is complete
 * @throws An error if the extraction fails
 *
 * @example
 * ```ts
 * import { unzip } from '$lib/utils/unzip';
 * import { appDataDir } from '@tauri-apps/api/path';
 * import { join } from '@tauri-apps/api/path';
 *
 * const appData = await appDataDir();
 * const zipPath = await join(appData, 'overlays', 'myoverlay.zip');
 * const destPath = await join(appData, 'overlays', 'myoverlay');
 *
 * await unzip(zipPath, destPath);
 * ```
 */
export async function unzip(zipPathOrUrl: string, destination: string): Promise<void> {
	// Check if it's a URL (http://, https://, or starts with /)
	const isUrl = /^(https?:\/\/|\/)/i.test(zipPathOrUrl);

	if (isUrl) {
		// Fetch the file as bytes
		const response = await fetch(zipPathOrUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch zip file: ${response.status} ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const bytes = new Uint8Array(arrayBuffer);

		// Use the bytes command
		await invoke('unzip_bytes', { zipData: Array.from(bytes), destination });
	} else {
		// Use the file path command
		await invoke('unzip_file', { zipPath: zipPathOrUrl, destination });
	}
}

/**
 * Compares a log timestamp (HH:MM:SS.ms) with a game date string (various formats)
 * Returns true if the hours and minutes match
 *
 * @param logTimestamp - Timestamp from the log file (e.g. "19:00:20.90")
 * @param gameDate - Date string from the replay file (e.g. "2024-11-03 오후 3:55" or "24/02/2024 11:07 AM")
 */
export function doesMatchGameDate(logTimestamp: string, gameDate: string): boolean {
	try {
		// Extract HH:MM from log timestamp (assuming 24h format)
		// Format: 19:00:20.90
		const logTimeMatch = logTimestamp.match(/(\d{1,2}):(\d{2})/);
		if (!logTimeMatch) return false;

		const logHour = parseInt(logTimeMatch[1], 10);
		const logMinute = parseInt(logTimeMatch[2], 10);

		// Extract time from gameDate
		// Supports:
		// - "오후 3:55" (Korean PM)
		// - "오전 11:07" (Korean AM)
		// - "11:07 AM"
		// - "3:55 PM"
		// - "15:55" (24h)

		// Regex to find time at the end of the string
		// Looks for HH:MM optionally followed by AM/PM, or preceded by 오전/오후
		const timeRegex = /(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i;
		const dateMatch = gameDate.match(timeRegex);

		if (!dateMatch) return false;

		const [, koreanMeridiem, hourStr, minuteStr, englishMeridiem] = dateMatch;
		let gameHour = parseInt(hourStr, 10);
		const gameMinute = parseInt(minuteStr, 10);
		const meridiem = (koreanMeridiem || englishMeridiem || '').toUpperCase();

		// Convert to 24h format
		if (meridiem === 'PM' || meridiem === '오후') {
			if (gameHour < 12) gameHour += 12;
		} else if (meridiem === 'AM' || meridiem === '오전') {
			if (gameHour === 12) gameHour = 0;
		}

		return logHour === gameHour && logMinute === gameMinute;
	} catch (e) {
		console.error('Error comparing timestamps:', e);
		return false;
	}
}
