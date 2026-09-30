import { z } from 'zod';
import {
	REWARD_CONDITIONS_MAX,
	REWARD_METRIC_CATALOG,
	REWARD_METRICS,
	rewardConditionKey,
	type RewardCondition
} from '@company-of-heroes/ui/reward/metrics';

export const rewardConditionSchema = z
	.object({
		metric: z.enum(REWARD_METRICS),
		threshold: z.number().int().min(1).max(1_000_000),
		filter: z
			.object({
				raceId: z.number().int().min(0).max(3).optional(),
				matchtypeId: z.number().int().min(0).max(17).optional(),
				ranked: z.boolean().optional(),
				map: z.string().trim().min(1).max(100).optional(),
				minMinutes: z.number().int().min(1).max(600).optional(),
				maxMinutes: z.number().int().min(1).max(600).optional(),
				pro: z.literal(true).optional(),
				minAvgElo: z.number().int().min(0).max(3000).optional()
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
