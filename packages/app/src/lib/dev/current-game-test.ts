// Generated from PocketBase lobby xs7mk2ona3l6e7v
import type { LobbyPlayer } from '@fknoobs/app';
import type { Match } from '$core/game/lobby';
import players from './current-game-players.json';

const me = (players as LobbyPlayer[]).find((player) => player.playerId === 2011215);

export const CURRENT_GAME_TEST = {
	sessionId: 147716060,
	startedAt: "21:01:07.400",
	map: "8p_montargis region",
	didNotify: false,
	started: true,
	isRanked: true,
	outcomeFormatted: "Unknown",
	matchType: 4,
	isSkirmish: false,
	type: "4 VS. 4",
	mapName: "Montargis Region (8)",
	teams: [],
	players: players as LobbyPlayer[],
	me
} as Match;
