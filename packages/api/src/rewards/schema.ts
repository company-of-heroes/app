import { z } from 'zod';
import {
	REWARD_CONDITIONS_MAX,
	REWARD_MATCHTYPE_IDS,
	REWARD_METRIC_CATALOG,
	REWARD_METRICS,
	rewardConditionKey,
	type RewardCondition
} from '@company-of-heroes/ui/reward/metrics';

/** Highest rating an `elo_reached` condition may ask for (same cap as the lobby ELO filter). */
export const REWARD_ELO_MAX = 3000;

export const rewardConditionSchema = z
	.object({
		metric: z.enum(REWARD_METRICS),
		threshold: z.number().int().min(1).max(1_000_000),
		filter: z
			.object({
				raceId: z.number().int().min(0).max(3).optional(),
				matchtypeId: z
					.number()
					.int()
					.refine((id) => (REWARD_MATCHTYPE_IDS as readonly number[]).includes(id), {
						message: 'Skirmish does not count toward rewards.'
					})
					.optional(),
				ranked: z.boolean().optional(),
				map: z.string().trim().min(1).max(100).optional(),
				minMinutes: z.number().int().min(1).max(600).optional(),
				maxMinutes: z.number().int().min(1).max(600).optional(),
				pro: z.literal(true).optional(),
				minAvgElo: z.number().int().min(0).max(REWARD_ELO_MAX).optional()
			})
			.optional()
	})
	.refine(
		(condition) =>
			Object.keys(condition.filter ?? {}).every((key) =>
				REWARD_METRIC_CATALOG[condition.metric].filters.includes(key as never)
			),
		{ message: 'This metric does not support that filter.' }
	)
	.refine(
		(condition) => !REWARD_METRIC_CATALOG[condition.metric].boolean || condition.threshold === 1,
		{ message: 'Yes/no conditions have a threshold of 1.' }
	)
	.refine(
		(condition) => {
			const max = REWARD_METRIC_CATALOG[condition.metric].max;
			return max === undefined || condition.threshold <= max;
		},
		{ message: 'The threshold is above the highest reachable value.' }
	)
	.refine(
		(condition) => condition.metric !== 'elo_reached' || condition.threshold <= REWARD_ELO_MAX,
		{ message: 'The threshold is above the highest reachable value.' }
	)
	.refine(
		(condition) => {
			const allowed = REWARD_METRIC_CATALOG[condition.metric].matchtypeIds;
			const matchtypeId = condition.filter?.matchtypeId;
			return !allowed || matchtypeId === undefined || allowed.includes(matchtypeId);
		},
		{ message: 'This metric does not support that mode.' }
	)
	.refine(
		({ filter }) =>
			filter?.minMinutes === undefined ||
			filter?.maxMinutes === undefined ||
			filter.minMinutes <= filter.maxMinutes,
		{ message: 'The minimum duration must be below the maximum.' }
	);

export const rewardConditionsSchema = z
	.array(rewardConditionSchema)
	.min(1)
	.max(REWARD_CONDITIONS_MAX)
	.refine((conditions) => new Set(conditions.map(rewardConditionKey)).size === conditions.length, {
		message: 'Each condition needs a different metric or filter.'
	});

/** Stored conditions, or null when they are not valid. */
export function parseRewardConditions(raw: unknown): RewardCondition[] | null {
	let value = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}

	const parsed = rewardConditionsSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
