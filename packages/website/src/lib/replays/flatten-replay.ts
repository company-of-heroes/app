import {
	formatTickTimestamp,
	playerCpmLabel,
	type Player,
	type Replay
} from '@fknoobs/replay-parser';

/** Legacy flat chat line (UI / PocketBase `messages` JSON). */
export type FlatReplayMessage = {
	playerID: number;
	sender: string;
	recipient: number;
	timestamp: string;
	content: string;
	tick: number;
};

/** Legacy flat action (UI replay timeline). */
export type FlatReplayAction = {
	tick: number;
	timestamp: string;
	playerID?: number;
	commandID?: number;
	objectID?: number;
	command?: { type?: string; name?: string; description?: string } | null;
};

/**
 * Flat v1-shaped replay used by app/website UI and upload payloads.
 * Built from `@fknoobs/replay-parser` v2 {@link Replay}.
 */
export type FlatReplay = {
	duration: number;
	gameDate: string;
	highResources: boolean;
	randomStart: boolean;
	mapFileName: string;
	mapName: string;
	matchType: string;
	vpGame: boolean;
	vpCount: number;
	players: Player[];
	messages: FlatReplayMessage[];
	actions: FlatReplayAction[];
	replayName: string;
	playerCount: number;
	cpmByPlayerId: Record<string, string>;
};

export function flattenReplay(
	replay: Replay,
	{ includeActions = true }: { includeActions?: boolean } = {}
): FlatReplay {
	const { header } = replay;
	const cpmByPlayerId: Record<string, string> = {};
	for (const player of replay.players) {
		if (player.id == null) {
			continue;
		}

		cpmByPlayerId[String(player.id)] = playerCpmLabel(replay, player.id);
	}

	return {
		duration: replay.durationSeconds,
		gameDate: header.gameDate,
		highResources: header.highResources,
		randomStart: header.randomStart,
		mapFileName: header.mapFileName,
		mapName: header.mapName,
		matchType: header.matchType,
		vpGame: header.vpGame,
		vpCount: header.vpCount,
		players: replay.players,
		messages: replay.chat.map((message) => ({
			playerID: message.playerId,
			sender: message.sender,
			recipient: message.recipient,
			timestamp: formatTickTimestamp(message.tick),
			content: message.content,
			tick: message.tick
		})),
		actions: includeActions
			? replay.actions.map((action) => ({
					tick: action.tick,
					timestamp: formatTickTimestamp(action.tick),
					playerID: action.playerId,
					commandID: action.commandId,
					objectID: action.objectId,
					command: action.command ?? null
				}))
			: [],
		replayName: header.replayName,
		playerCount: replay.players.length,
		cpmByPlayerId
	};
}

/** Initial worker payload: metadata + chat + CPM, actions loaded lazily. */
export function toSlimReplay(flat: FlatReplay) {
	return {
		...flat,
		actions: [] as FlatReplayAction[]
	};
}
