import {
	REWARD_CONDITIONS_MAX,
	REWARD_METRIC_CATALOG,
	REWARD_METRICS,
	rewardConditionKey,
	type RewardCondition,
	type RewardConditionFilter,
	type RewardFilterKey,
	type RewardMetric
} from './metrics';

/** Select value for "no filter". */
export const CONDITION_ANY = 'any';

/** One condition as the form edits it: selects hold strings, number fields may be empty. */
export type RewardConditionRow = {
	key: number;
	metric: RewardMetric;
	threshold: number | string;
	raceId: string;
	matchtypeId: string;
	ranked: string;
	map: string;
	minMinutes: number | string;
	maxMinutes: number | string;
	pro: boolean;
	minAvgElo: number | string;
};

export type RewardConditionError =
	| { kind: 'threshold' }
	| { kind: 'max'; max: number }
	| { kind: 'duration' }
	| { kind: 'duplicate' };

export function supportsFilter(row: Pick<RewardConditionRow, 'metric'>, filter: RewardFilterKey) {
	return REWARD_METRIC_CATALOG[row.metric].filters.includes(filter);
}

/** Some metrics only exist for a few modes (ladder rank: automatch 1v1 to 4v4). */
export function allowsMode(row: Pick<RewardConditionRow, 'metric'>, value: string) {
	const allowed = REWARD_METRIC_CATALOG[row.metric].matchtypeIds;
	return value === CONDITION_ANY || !allowed || allowed.includes(Number(value));
}

/** A filled-in number field, or undefined when left empty. */
function optionalNumber(value: number | string): number | undefined {
	return value === '' || value === null ? undefined : Math.round(Number(value));
}

function toCondition(row: RewardConditionRow): RewardCondition {
	const filter: RewardConditionFilter = {};
	if (supportsFilter(row, 'raceId') && row.raceId !== CONDITION_ANY) {
		filter.raceId = Number(row.raceId);
	}

	if (
		supportsFilter(row, 'matchtypeId') &&
		row.matchtypeId !== CONDITION_ANY &&
		allowsMode(row, row.matchtypeId)
	) {
		filter.matchtypeId = Number(row.matchtypeId);
	}

	if (supportsFilter(row, 'ranked') && row.ranked !== CONDITION_ANY) {
		filter.ranked = row.ranked === 'true';
	}

	if (supportsFilter(row, 'map') && row.map !== CONDITION_ANY) {
		filter.map = row.map;
	}

	if (supportsFilter(row, 'minMinutes') && optionalNumber(row.minMinutes) !== undefined) {
		filter.minMinutes = optionalNumber(row.minMinutes);
	}

	if (supportsFilter(row, 'maxMinutes') && optionalNumber(row.maxMinutes) !== undefined) {
		filter.maxMinutes = optionalNumber(row.maxMinutes);
	}

	if (supportsFilter(row, 'pro') && row.pro) {
		filter.pro = true;
	}

	if (supportsFilter(row, 'minAvgElo') && optionalNumber(row.minAvgElo) !== undefined) {
		filter.minAvgElo = optionalNumber(row.minAvgElo);
	}

	return {
		metric: row.metric,
		threshold: REWARD_METRIC_CATALOG[row.metric].boolean
			? 1
			: Math.round(Number(row.threshold)) || 0,
		...(Object.keys(filter).length > 0 ? { filter } : {})
	};
}

/**
 * Form state for a list of reward conditions (rewards, auto labels). `min` is the fewest
 * rows the list keeps: 1 for rewards, 0 where conditions are optional.
 */
export class RewardConditionsEditor {
	rows = $state<RewardConditionRow[]>([]);
	readonly conditions = $derived(this.rows.map(toCondition));
	readonly errors = $derived(
		this.conditions.map((condition, index) => this.error(condition, index))
	);
	readonly hasErrors = $derived(this.errors.some(Boolean));
	#nextKey = 0;

	constructor(readonly min = 1) {
		this.reset();
	}

	get canAdd() {
		return this.rows.length < REWARD_CONDITIONS_MAX;
	}

	get canRemove() {
		return this.rows.length > this.min;
	}

	reset() {
		this.rows = Array.from({ length: this.min }, () => this.row());
	}

	load(conditions: readonly RewardCondition[] | null | undefined) {
		this.rows = (conditions ?? []).map((condition) => {
			const filter = condition.filter ?? {};
			return {
				...this.row(condition.metric),
				threshold: condition.threshold,
				raceId: filter.raceId !== undefined ? String(filter.raceId) : CONDITION_ANY,
				matchtypeId: filter.matchtypeId !== undefined ? String(filter.matchtypeId) : CONDITION_ANY,
				ranked: filter.ranked !== undefined ? String(filter.ranked) : CONDITION_ANY,
				map: filter.map ?? CONDITION_ANY,
				minMinutes: filter.minMinutes ?? '',
				maxMinutes: filter.maxMinutes ?? '',
				pro: Boolean(filter.pro),
				minAvgElo: filter.minAvgElo ?? ''
			};
		});
		if (this.rows.length < this.min) {
			this.reset();
		}
	}

	/** Adds a row with the first metric not used yet. */
	add() {
		const used = new Set(this.conditions.map(rewardConditionKey));
		const metric =
			REWARD_METRICS.find((candidate) => !used.has(rewardConditionKey({ metric: candidate }))) ??
			'matches_played';
		this.rows = [...this.rows, this.row(metric)];
	}

	remove(key: number) {
		this.rows = this.rows.filter((row) => row.key !== key);
	}

	private row(metric: RewardMetric = 'matches_played'): RewardConditionRow {
		return {
			key: this.#nextKey++,
			metric,
			threshold: 10,
			raceId: CONDITION_ANY,
			matchtypeId: CONDITION_ANY,
			ranked: CONDITION_ANY,
			map: CONDITION_ANY,
			minMinutes: '',
			maxMinutes: '',
			pro: false,
			minAvgElo: ''
		};
	}

	/** Why one condition is not valid, or null. */
	private error(condition: RewardCondition, index: number): RewardConditionError | null {
		if (condition.threshold < 1) {
			return { kind: 'threshold' };
		}

		const max = REWARD_METRIC_CATALOG[condition.metric].max;
		if (max !== undefined && condition.threshold > max) {
			return { kind: 'max', max };
		}

		const { minMinutes, maxMinutes } = condition.filter ?? {};
		if (minMinutes !== undefined && maxMinutes !== undefined && minMinutes > maxMinutes) {
			return { kind: 'duration' };
		}

		const key = rewardConditionKey(condition);
		if (this.conditions.findIndex((other) => rewardConditionKey(other) === key) < index) {
			return { kind: 'duplicate' };
		}

		return null;
	}
}
