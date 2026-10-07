import { parseReplay, type Action } from '@fknoobs/replay-parser';
import { raceFromReplayFaction } from '@company-of-heroes/ui/replay/stats';
import type { ReplaySummary, ReplaySummaryPlayer } from '@company-of-heroes/ui/statistics/types';
import { isAiSeat } from './replay-skirmish';

/** What every human player in a replay built, bought and picked (for community statistics). */

/**
 * Bump when a parser or summary change alters stored results; the replay-stats jobs then
 * summarize older versions again. 3: Commonwealth command trucks decode as their own squads, and
 * players sharing a name no longer get each other's doctrine.
 */
export const REPLAY_SUMMARY_VERSION = 3;

const EMPTY: ReplaySummary = { v: REPLAY_SUMMARY_VERSION, players: [] };

/** Engineers, Sappers and Pioneers: almost every game starts with one, so they say nothing about the opening. */
export const BUILDERS = new Set([10, 121, 188]);

/** Commonwealth Armor Command and Field Support Trucks: base buildings on wheels, not an opening. */
const COMMAND_TRUCKS = new Set([130, 152]);

const orderKey = (tick: number, objectId: number) => `${tick}|${objectId}`;

function summarizePlayer(
	race: number,
	doctrine: number | null,
	actions: Action[]
): ReplaySummaryPlayer {
	// Orders a later CANCEL_QUEUE took back never produced anything.
	const cancelled = new Set<string>();
	for (const action of actions) {
		if (action.command?.type === 'CANCEL_QUEUE' && action.cancelled) {
			cancelled.add(orderKey(action.cancelled.tick, action.cancelled.objectId));
		}
	}

	const units: Record<string, number> = {};
	const upgrades: Record<string, number> = {};
	let opening: number | null = null;
	for (const action of actions) {
		const type = action.command?.type;
		if (
			(type !== 'UNIT' && type !== 'UPGRADE') ||
			cancelled.has(orderKey(action.tick, action.objectId))
		) {
			continue;
		}

		const counts = type === 'UNIT' ? units : upgrades;
		counts[action.objectId] = (counts[action.objectId] ?? 0) + 1;
		if (
			type === 'UNIT' &&
			opening === null &&
			!BUILDERS.has(action.objectId) &&
			!COMMAND_TRUCKS.has(action.objectId)
		) {
			opening = action.objectId;
		}
	}

	return { race, doctrine, units, upgrades, opening };
}

/**
 * Per human player: race, doctrine, units and upgrades ordered (minus cancelled ones) and the
 * first unit that is not a builder. Actions stop at an AI takeover; repeats of one order in the same tick count once.
 * A replay that does not parse gives no players, so it is not retried.
 */
export function summarizeReplay(bytes: ArrayBuffer | Uint8Array): ReplaySummary {
	try {
		const replay = parseReplay(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
		if (!replay.meta.headerOk || !replay.meta.dataOk) {
			return EMPTY;
		}

		const byPlayer = new Map<number, Action[]>();
		const seen = new Set<string>();
		const takenOver = new Set<number>();
		for (const action of replay.actions) {
			if (takenOver.has(action.playerId)) {
				continue;
			}

			if (action.command?.type === 'AI_TAKEOVER') {
				takenOver.add(action.playerId);
				continue;
			}

			const key = `${action.playerId}|${action.tick}|${action.commandId}|${action.objectId}`;
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			const list = byPlayer.get(action.playerId);
			if (list) {
				list.push(action);
			} else {
				byPlayer.set(action.playerId, [action]);
			}
		}

		return {
			v: REPLAY_SUMMARY_VERSION,
			ai: replay.players.some(isAiSeat),
			players: replay.players
				.filter((player) => player.id != null && player.name !== '' && !isAiSeat(player))
				.map((player) =>
					summarizePlayer(
						raceFromReplayFaction(player.faction),
						player.doctrine ?? null,
						byPlayer.get(player.id as number) ?? []
					)
				)
		};
	} catch (error) {
		console.error('[replay-summary] parse failed', error);
		return EMPTY;
	}
}
