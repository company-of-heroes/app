import { isBoolean, isNaN, isString } from 'lodash-es';

export function isBigInt(value: any): value is bigint {
	try {
		return BigInt(parseInt(value, 10)) !== BigInt(value);
	} catch (e) {
		return false;
	}
}

export function isNumeric(str: any) {
	return !isNaN(parseFloat(str)) && isFinite(str);
}

export function convertToType(value: any) {
	if (isBigInt(value)) return BigInt(value);
	if (isNumeric(value)) return Number(value);
	if (isBoolean(value)) return Boolean(value);
	if (isString(value)) return String(value);
	return value;
}

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
 * Maps a player’s seating index to a “slot” around the table,
 * by placing indices 0,1,2… alternately on opposite sides.
 * Works for any even playerCount.
 *
 * @param index       zero‑based player index (0 ≤ index < playerCount)
 * @param playerCount total number of players (must be even)
 * @returns           slot number in [0 … playerCount‑1]
 */
export function getPlayerSlotByIndex(index: number, playerCount: number): number {
	if (playerCount % 2 !== 0) {
		throw new Error(`playerCount must be even, got ${playerCount}`);
	}
	if (index < 0 || index >= playerCount) {
		throw new RangeError(`index must be between 0 and ${playerCount - 1}, got ${index}`);
	}

	// Spread out indices: [0,2,4,…] then [1,3,5,…]
	const doubled = index * 2;
	const wrapAround = doubled % playerCount;
	const carry = Math.floor(doubled / playerCount);
	return wrapAround + carry;
}

export function randomId() {
	return Math.floor(Math.random() * (9999999 - 1000000 + 1)) + 1000000;
}
