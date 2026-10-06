import { parseHeader } from '@fknoobs/replay-parser';

/**
 * Replay DATAINFO `dataInfo1` per seat: 0 host, 2 other human, 1/3 AI, 5 empty seat.
 * The header's `matchType` is just the lobby name ("asd", "skirmish", …), so it says nothing.
 */
const AI_SEATS = new Set([1, 3]);
const AI_NAME = /^CPU - /;

/** A replay seat played by the computer. */
export function isAiSeat(player: { name: string; dataInfo1?: number }): boolean {
	return player.dataInfo1 === undefined
		? AI_NAME.test(player.name)
		: AI_SEATS.has(player.dataInfo1) && player.name !== '';
}

/** True when the replay has a computer player: a skirmish, whatever the lobby was titled. */
export function replayHasAi(bytes: ArrayBuffer | Uint8Array): boolean {
	try {
		const { players, meta } = parseHeader(bytes);
		if (!meta.headerOk) {
			return false;
		}

		return players.some(isAiSeat);
	} catch {
		return false;
	}
}

/** What a lobby without a Relic result becomes once its replay shows AI players. */
export const SKIRMISH_FIELDS = { title: 'Skirmish', isRanked: false, needsResult: false } as const;
