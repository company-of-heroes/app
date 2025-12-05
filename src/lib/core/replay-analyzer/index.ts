import type { Action, Message, Player, Replay } from './replay';
import { ReplayParser } from './replay-parser';
import { invoke } from '@tauri-apps/api/core';
import type { ParsedReplay } from './simple-replay-parser';

export { ReplayParser, type Replay, type Player, type Message, type Action };
export type { ParsedReplay } from './simple-replay-parser';

/**
 * Parses a replay file using the optimized Rust backend.
 *
 * @param filePath - The absolute path to the .rec file
 * @returns Promise resolving to the parsed replay data
 */
export async function parseReplayFile(filePath: string): Promise<ParsedReplay> {
	try {
		return await invoke<ParsedReplay>('parse_replay', { path: filePath });
	} catch (error) {
		console.error('Rust replay parser failed:', error);
		throw error;
	}
}
