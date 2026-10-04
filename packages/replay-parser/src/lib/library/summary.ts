import { parseReplay } from '@fknoobs/replay-parser';
import type { ReplaySummary } from './types';

/** Full parse (duration needs the tick stream) without command name tables. */
export function summarizeReplay(bytes: Uint8Array): ReplaySummary {
	const replay = parseReplay(bytes, { enrichCommands: false });
	const { header } = replay;
	return {
		replayName: header.replayName,
		mapFileName: header.mapFileName,
		mapName: header.mapName,
		gameDate: header.gameDate,
		matchType: header.matchType,
		highResources: header.highResources,
		randomStart: header.randomStart,
		vpGame: header.vpGame,
		vpCount: header.vpCount,
		durationSeconds: Math.round(replay.durationSeconds),
		players: replay.players.map((player) => ({
			slot: player.slot,
			name: player.name,
			faction: player.faction,
			team: player.dataInfo2 ?? (player.faction.startsWith('axis') ? 1 : 0),
			doctrine: player.doctrine,
			doctrineName: player.doctrineName
		})),
		headerOk: replay.meta.headerOk
	};
}
