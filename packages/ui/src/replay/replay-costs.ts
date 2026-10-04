import { ACTION_COSTS } from './action-costs';
import { timelineActionsByPlayer } from './replay-stats';
import { isCancelAction, type ReplayAction, type ReplayData } from './types';

/** Resource cost of an order, from the game's attrib data (see `action-costs.ts`). */
export type ActionCost = {
	manpower?: number;
	fuel?: number;
	munition?: number;
	popcap?: number;
	/** Command points (doctrine picks). */
	command?: number;
	/** Build / research time. */
	seconds?: number;
};

export type SpentResource = 'manpower' | 'fuel' | 'munition' | 'command';

/**
 * Resource text colours from the game's HUD (`art/ui/screens/taskbar_widescreen.screen`,
 * `help_*_txt`). The matching icon tints are baked into `shared-assets/actions/resource_*.png`.
 */
export const RESOURCE_COLOURS: Partial<Record<keyof ActionCost, string>> = {
	manpower: '#c0a345',
	fuel: '#ad7226',
	munition: '#bd7a4b'
};
export const SPENT_RESOURCES: readonly SpentResource[] = [
	'manpower',
	'fuel',
	'munition',
	'command'
];

/** Blueprint list an action type indexes into (objectID = index in that sorted list). */
const COST_LIST: Record<string, string> = {
	UNIT: 'sbps',
	BUILDING: 'ebps',
	UPGRADE: 'upgrade',
	DOCTRINAL: 'upgrade',
	SPECIAL_ABILITY: 'abilities',
	UNIT_COMMAND: 'abilities',
	REINFORCE: 'reinforce'
};

/** Opcode of a cancelled order → its action type (cancels only carry the opcode). */
const TYPE_BY_OPCODE: Record<number, string> = {
	0x3: 'UNIT',
	0x52: 'UNIT',
	0x34: 'UPGRADE',
	0x14: 'UPGRADE',
	0x33: 'REINFORCE',
	0x57: 'BUILDING',
	0x64: 'BUILDING'
};

export type BlueprintRef = { list: string; objectID: number };

function ref(type: string | undefined, objectID: number | undefined): BlueprintRef | null {
	const list = type ? COST_LIST[type] : undefined;
	return list && objectID != null ? { list, objectID } : null;
}

/**
 * The game blueprint an action refers to (list + index). A cancel refers to the order it removed.
 * Shared by the cost table and the in-game descriptions (`replay-action-info.ts`).
 */
export function blueprintRef(action: ReplayAction): BlueprintRef | null {
	if (isCancelAction(action)) {
		const order = action.cancelled;
		return order
			? ref(order.command?.type ?? TYPE_BY_OPCODE[order.commandID], order.objectID)
			: null;
	}

	// The parser relabels production opcode 0x3 / object 3 as a repair command; its objectID is not
	// an ability index.
	if (action.command?.type === 'UNIT_COMMAND' && action.commandID !== 0x37) {
		return null;
	}

	return ref(action.command?.type, action.objectID);
}

/**
 * Cost of an action. A cancel returns the cost of the order it removed with `refunded: true`
 * (CoH1 refunds cancelled queue items and building sites in full).
 */
export function actionCost(action: ReplayAction): (ActionCost & { refunded?: boolean }) | null {
	const target = blueprintRef(action);
	const cost = target ? ACTION_COSTS[target.list]?.[target.objectID] : undefined;
	if (!cost) {
		return null;
	}

	return isCancelAction(action) ? { ...cost, refunded: true } : cost;
}

export type SpendPoint = { second: number } & Record<SpentResource, number>;

export type PlayerSpend = {
	/** Cumulative spend after each costed order, starting at 0. */
	series: SpendPoint[];
	totals: Record<SpentResource, number>;
};

const spendCache = new WeakMap<ReplayAction[], Map<number, PlayerSpend>>();

/**
 * Estimated resources spent per player: the cost of every order (units, buildings, upgrades,
 * abilities, reinforcements, doctrine picks) minus refunded cancels. Orders the game rejected for
 * lack of resources still count, and income is not in replays.
 */
export function playerSpend(replay: ReplayData): Map<number, PlayerSpend> {
	const cached = spendCache.get(replay.actions);
	if (cached) {
		return cached;
	}

	const result = new Map<number, PlayerSpend>();
	for (const [playerId, actions] of timelineActionsByPlayer(replay)) {
		const totals: Record<SpentResource, number> = { manpower: 0, fuel: 0, munition: 0, command: 0 };
		const series: SpendPoint[] = [{ second: 0, ...totals }];
		for (const action of actions) {
			const cost = actionCost(action);
			if (!cost) {
				continue;
			}

			const sign = cost.refunded ? -1 : 1;
			let changed = false;
			for (const resource of SPENT_RESOURCES) {
				if (cost[resource]) {
					totals[resource] += sign * cost[resource]!;
					changed = true;
				}
			}

			if (changed) {
				series.push({ second: action.tick / 8, ...totals });
			}
		}
		result.set(playerId, { series, totals: { ...totals } });
	}
	spendCache.set(replay.actions, result);
	return result;
}
