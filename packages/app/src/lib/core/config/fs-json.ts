import { exists, readTextFile, writeTextFile, rename, remove } from '@tauri-apps/plugin-fs';

/**
 * Atomic JSON file IO.
 *
 * Writes go to `<path>.tmp` first and are then swapped into place, so a crash
 * mid-write never corrupts the destination. Because `rename` fails on Windows
 * when the destination exists, the destination is removed right before the
 * swap; if the process dies in between, `readJsonWithRecovery` falls back to
 * the fully-written `.tmp` file.
 */

export function tmpPath(path: string): string {
	return `${path}.tmp`;
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
	const tmp = tmpPath(path);
	const content = JSON.stringify(value, null, '\t');

	await writeTextFile(tmp, content);

	if (await exists(path)) {
		await remove(path);
	}

	await rename(tmp, path);
}

export type ReadJsonResult =
	| { ok: true; data: unknown; recoveredFromTmp: boolean }
	| { ok: false; error: 'missing' | 'invalid' };

/**
 * Reads and parses a JSON file. When the destination is missing or corrupt but
 * a complete `.tmp` file from an interrupted atomic write exists, recovers
 * from that instead.
 */
export async function readJsonWithRecovery(path: string): Promise<ReadJsonResult> {
	const primary = await tryReadJson(path);

	if (primary !== undefined) {
		return { ok: true, data: primary, recoveredFromTmp: false };
	}

	const fallback = await tryReadJson(tmpPath(path));

	if (fallback !== undefined) {
		return { ok: true, data: fallback, recoveredFromTmp: true };
	}

	return { ok: false, error: (await exists(path)) ? 'invalid' : 'missing' };
}

async function tryReadJson(path: string): Promise<unknown | undefined> {
	try {
		if (!(await exists(path))) {
			return undefined;
		}

		const content = await readTextFile(path);
		return JSON.parse(content) as unknown;
	} catch {
		return undefined;
	}
}
