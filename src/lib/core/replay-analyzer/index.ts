import ReplayParser from './replay-parser';
import { Action, Coordinate, Message, Player, Replay, Tick } from './replay';
import { ActionDefinition, ActionDefinitions } from './action-definitions';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseReplay, type ParsedReplay } from './simple-replay-parser';

/**
 * Adapter function that maintains compatibility with the existing API
 * while using the new simplified parser internally
 */
export async function parseReplayFile(
	filePath: string,
	headerOnly: boolean = false
): Promise<ParsedReplay> {
	// Read the file as Uint8Array
	const fileData = await readFile(filePath);

	// Extract filename from path
	const fileName = filePath.split(/[/\\]/).pop() || 'unknown.rec';

	// Parse using the simplified parser
	const result = parseReplay(fileData, fileName, headerOnly);

	// If headerOnly is true, clear the actions and messages to save memory
	if (headerOnly) {
		result.actions = [];
		result.messages = [];
		result.actionCount = 0;
		result.messageCount = 0;
	}

	return result;
}

/**
 * Direct parser function that takes Uint8Array as requested
 */
export { parseReplay } from './simple-replay-parser';
export type { ParsedReplay } from './simple-replay-parser';

// Legacy exports for backward compatibility

export {
	ReplayParser,
	Action,
	Coordinate,
	Message,
	Player,
	Replay,
	Tick,
	ActionDefinition,
	ActionDefinitions
};
