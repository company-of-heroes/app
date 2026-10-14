import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { LeaderboardStat, PlayerEloMap } from '@company-of-heroes/ui/player/types';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { headToHeadSchema, type HeadToHead } from '../head-to-head/head-to-head';
import {
	performanceSchema,
	type PlayerPerformance
} from '../player-performance/player-performance';

export type CompareAccount = {
	steamId: string;
	name: string | null;
	avatarUrl: string | null;
	profileId: number | null;
};

/** One linked account's own numbers; the page combines the selected ones. */
export type CompareAccountData = {
	steamId: string;
	leaderboardStats: LeaderboardStat[];
	elo: PlayerEloMap;
	/** Every map (no top 8), so combined accounts rank maps correctly. */
	performance: PlayerPerformance;
	headToHead: HeadToHead;
};

export type CompareData = {
	/** Every linked account, for the toggles. */
	accounts: CompareAccount[];
	/** True when `them` is one of the user's own accounts; `mine` then has no head to head. */
	isSelf: boolean;
	mine: CompareAccountData[];
	them: {
		steamId: string;
		profileId: number;
		alias: string;
		avatarUrl: string | null;
		country: string | null;
		level: number;
		leaderboardStats: LeaderboardStat[];
		elo: PlayerEloMap;
		performance: PlayerPerformance;
	};
};

const leaderboardStatSchema = z.object({
	leaderboard_id: z.number(),
	wins: z.number(),
	losses: z.number(),
	streak: z.number(),
	rank: z.number(),
	ranklevel: z.number()
});

const eloMapSchema = z.record(
	z.string(),
	z.record(
		z.string(),
		z.object({
			rating: z.number(),
			matchId: z.number(),
			at: z.number()
		})
	)
);

const compareSchema = z.object({
	accounts: z.array(
		z.object({
			steamId: z.string(),
			name: z.string().nullable(),
			avatarUrl: z.string().nullable(),
			profileId: z.number().nullable()
		})
	),
	isSelf: z.boolean(),
	mine: z.array(
		z.object({
			steamId: z.string(),
			leaderboardStats: z.array(leaderboardStatSchema),
			elo: eloMapSchema,
			performance: performanceSchema,
			headToHead: headToHeadSchema
		})
	),
	them: z.object({
		steamId: z.string(),
		profileId: z.number(),
		alias: z.string(),
		avatarUrl: z.string().nullable(),
		country: z.string().nullable(),
		level: z.number(),
		leaderboardStats: z.array(leaderboardStatSchema),
		elo: eloMapSchema,
		performance: performanceSchema
	})
}) satisfies z.ZodType<CompareData, unknown>;

export class CompareApi {
	constructor(private deps: ApiDeps) {}

	/** You against a player, per linked account (the page combines the selected ones). */
	get(options: { them: string | number }): ResultAsync<CompareData, ApiError> {
		const params = new URLSearchParams({ them: String(options.them) });
		return ResultAsync.fromPromise(
			sendV1<unknown>(this.deps, `/compare?${params}`, { timeoutMs: 30_000 }),
			() => apiError(500, 'Failed to load comparison.')
		).andThen((value) => {
			const parsed = compareSchema.safeParse(value);
			if (!parsed.success) {
				return err(apiError(500, 'Failed to load comparison.'));
			}

			return ok<CompareData, ApiError>(parsed.data);
		});
	}
}
