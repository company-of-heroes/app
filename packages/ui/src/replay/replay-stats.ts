import type { ReplayAction, ReplayData, ReplayPlayer } from './types';

/** 0 = US, 1 = Wehrmacht, 2 = Commonwealth, 3 = Panzer Elite. */
export function raceFromReplayFaction(faction: string): number {
	const value = faction.toLowerCase();
	if (value.includes('commonwealth')) {
		return 2;
	}

	if (value.includes('panzer')) {
		return 3;
	}

	if (value.startsWith('axis')) {
		return 1;
	}

	return 0;
}

const ALLIED_DOCTRINE_BANNERS: Record<number, string> = {
	2: 'ct_branchbanner_top_allied_airborne.png',
	9: 'ct_branchbanner_top_allied_armor.png',
	17: 'ct_branchbanner_top_allied_infantry.png',
	316: 'ct_branchbanner_top_cmnw_infantry.png',
	323: 'ct_branchbanner_top_cmnw_airborne.png',
	330: 'ct_branchbanner_top_cmnw_armor.png'
};

const AXIS_DOCTRINE_BANNERS: Record<number, string> = {
	186: 'ct_branchbanner_top_axis_blitz.png',
	194: 'ct_branchbanner_top_axis_defense.png',
	265: 'ct_branchbanner_top_axis_terror.png',
	295: 'ct_branchbanner_top_pnze_00.png',
	302: 'ct_branchbanner_top_pnze_01.png',
	309: 'ct_branchbanner_top_pnze_02.png'
};

/** Banner file name for a player's doctrine; hosts turn it into a URL. */
export function doctrineBannerFile(
	player: Pick<ReplayPlayer, 'doctrine' | 'faction'>
): string | null {
	const doctrine = player.doctrine;
	if (doctrine == null) {
		return null;
	}

	const banners = player.faction.startsWith('allies')
		? ALLIED_DOCTRINE_BANNERS
		: AXIS_DOCTRINE_BANNERS;
	return banners[doctrine] ?? null;
}

/** UNIT_COMMAND object IDs filtered by Replay Manager / C2A as non-input spam. */
const CPM_EXCLUDED_UNIT_COMMAND_IDS: ReadonlySet<number> = new Set([
	0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xa8
]);

const isAiTakeoverAction = (action: ReplayAction): boolean =>
	action.command?.type === 'AI_TAKEOVER';

const isCpmExcludedAction = (action: ReplayAction): boolean => {
	if (isAiTakeoverAction(action)) {
		return true;
	}

	return (
		(action.commandID ?? -1) === 0x37 && CPM_EXCLUDED_UNIT_COMMAND_IDS.has(action.objectID ?? -1)
	);
};

/** A player's input actions up to (and including) an AI takeover. */
export function countedActions(
	replay: ReplayData,
	playerId: number | null | undefined
): ReplayAction[] {
	if (playerId == null) {
		return [];
	}

	const actions = replay.actions.filter((action) => action.playerID === playerId);
	const takeover = actions.findIndex(isAiTakeoverAction);
	const window = takeover >= 0 ? actions.slice(0, takeover + 1) : actions;
	return window.filter((action) => !isCpmExcludedAction(action));
}

/**
 * CPM aligned with Replay Manager / C2A: unique (tick, commandID, objectID)
 * among eligible actions, divided by minutes until AI takeover (or match end).
 */
export function playerCpm(replay: ReplayData, playerId: number | null | undefined): string {
	if (playerId == null) {
		return '0';
	}

	const precomputed = replay.cpmByPlayerId?.[String(playerId)];
	if (precomputed != null) {
		return precomputed;
	}

	if (!(replay.duration > 0)) {
		return '0';
	}

	const playerActions = replay.actions.filter((action) => action.playerID === playerId);
	const takeover = playerActions.find(isAiTakeoverAction);
	const window = takeover ? playerActions.slice(0, playerActions.indexOf(takeover)) : playerActions;

	const keys = new Set<string>();
	for (const action of window) {
		if (isCpmExcludedAction(action)) {
			continue;
		}

		keys.add(`${action.tick}|${action.commandID ?? 0}|${action.objectID ?? 0}`);
	}
	if (keys.size === 0) {
		return '0';
	}

	const minutes = takeover
		? Math.max(takeover.tick / 8 / 60, 1 / 60)
		: Math.max(replay.duration / 60, 1 / 60);
	return String(Math.round(keys.size / minutes));
}
