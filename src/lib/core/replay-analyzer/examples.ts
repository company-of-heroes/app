/**
 * Example usage of the simplified replay parser
 *
 * This demonstrates how much simpler the new API is compared to the old one.
 */

import { parseReplay, parseReplayFile } from '$lib/core/replay-analyzer';

// Example 1: Parse from Uint8Array (your requested functionality)
async function parseFromArrayBuffer(arrayBuffer: ArrayBuffer) {
	const uint8Array = new Uint8Array(arrayBuffer);

	try {
		const replay = parseReplay(uint8Array, 'example.rec');

		console.log('Replay parsed successfully!');
		console.log('Players:', replay.playerCount);
		console.log('Duration:', replay.duration, 'seconds');
		console.log('Map:', replay.mapNameFormatted);
		console.log('Match type:', replay.matchType);

		// Access all the same data as before
		replay.players.forEach((player) => {
			console.log(`Player: ${player.name} (${player.faction})`);
		});

		replay.messages.forEach((msg) => {
			console.log(`[${msg.timeStamp}] ${msg.playerName}: ${msg.text}`);
		});

		return replay;
	} catch (error) {
		console.error('Failed to parse replay:', error);
		throw error;
	}
}

// Example 2: Parse from file path (maintains compatibility)
async function parseFromFile(filePath: string) {
	try {
		// Parse full replay
		const replay = await parseReplayFile(filePath);

		// Or parse header only for performance
		const headerOnly = await parseReplayFile(filePath, true);

		return replay;
	} catch (error) {
		console.error('Failed to parse replay file:', error);
		throw error;
	}
}

// Example 3: Compare old vs new API

// OLD WAY (complex):
/*
import ReplayParser from '$lib/core/replay-analyzer/replay-parser';
import { Replay } from '$lib/core/replay-analyzer/replay';

async function oldWay(filePath: string) {
  const replay = await Replay.load(filePath);
  const parser = new ReplayParser(replay);
  const result = await parser.parseReplay(replay, false);
  
  console.log(result.players.length);  // Had to access through array length
  console.log(result.messages.length); // Had to access through array length
  console.log(result.actions.length);  // Had to access through array length
  
  return result;
}
*/

// NEW WAY (simple):
async function newWay(filePath: string) {
	const replay = await parseReplayFile(filePath);

	console.log(replay.playerCount); // Direct property
	console.log(replay.messageCount); // Direct property
	console.log(replay.actionCount); // Direct property

	return replay;
}

// Example 4: Working with teams
async function analyzeTeams(filePath: string) {
	const replay = await parseReplayFile(filePath);

	const [axis, allies] = replay.teams;

	console.log(
		'Axis team:',
		axis.map((p) => `${p.name} (${p.faction})`)
	);
	console.log(
		'Allied team:',
		allies.map((p) => `${p.name} (${p.faction})`)
	);

	// Analyze team balance
	console.log(`Team balance: ${axis.length} vs ${allies.length}`);

	return {
		axis,
		allies,
		isBalanced: axis.length === allies.length
	};
}

// Example 5: Batch processing
async function processManyReplays(replayFiles: Uint8Array[]) {
	const results = await Promise.all(
		replayFiles.map((data, index) => {
			try {
				return parseReplay(data, `replay_${index}.rec`);
			} catch (error) {
				console.warn(`Failed to parse replay ${index}:`, error);
				return null;
			}
		})
	);

	return results.filter((replay) => replay !== null);
}

// Export examples
export { parseFromArrayBuffer, parseFromFile, newWay, analyzeTeams, processManyReplays };
