import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { LeaderboardStat, PlayerEloMap } from '@company-of-heroes/ui/player/types';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import type { HeadToHead } from '../head-to-head/head-to-head';
import type { PlayerPerformance } from '../player-performance/player-performance';

export type CompareAccount = {
	steamId: string;
	name: string | null;
	avatarUrl: string | null;
	profileId: number | null;
	selected: boolean;
};

export type CompareBestRank = {
	leaderboardId: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	/** The account that holds it. */
	steamId: string;
};

export type CompareBestElo = {
	/** '1'..'7' */
	matchKey: string;
	/** '0'..'3' */
	raceKey: string;
	rating: number;
	steamId: string;
};

export type Compare = {
	/** Every linked account, for the toggles. */
	accounts: CompareAccount[];
	/** True when `them` is one of the user's own accounts; `me` and `headToHead` may then be empty. */
	isSelf: boolean;
	me: {
		performance: PlayerPerformance;
		best: CompareBestRank[];
		elo: CompareBestElo[];
	};
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
	headToHead: HeadToHead;
};

const performanceSchema = z
	.object({
		matchCount: z.number(),
		wins: z.number(),
		losses: z.number(),
		recentMatches: z.array(z.any()),
		byMap: z.array(z.any()),
		byFaction: z.array(z.any()),
		byMode: z.array(z.any())
	})
	.passthrough() as unknown as z.ZodType<PlayerPerformance>;

const headToHeadSchema = z.object({
	profileId: z.number(),
	matchCount: z.number(),
	wins: z.number(),
	losses: z.number(),
	lastSessionId: z.number().nullable(),
	byMatchup: z.array(
		z.object({
			raceId: z.number(),
			theirRaceId: z.number(),
			wins: z.number(),
			losses: z.number()
		})
	),
	byMode: z.array(
		z.object({
			matchtypeId: z.number(),
			wins: z.number(),
			losses: z.number()
		})
	),
	games: z
		.array(
			z.object({
				lobbyId: z.string(),
				sessionId: z.number(),
				won: z.boolean(),
				raceId: z.number().nullable(),
				theirRaceId: z.number().nullable(),
				matchtypeId: z.number().nullable(),
				map: z.string(),
				createdAt: z.string().nullable()
			})
		)
		.default([])
}) satisfies z.ZodType<HeadToHead, unknown>;

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
			profileId: z.number().nullable(),
			selected: z.boolean()
		})
	),
	isSelf: z.boolean(),
	me: z.object({
		performance: performanceSchema,
		best: z.array(
			z.object({
				leaderboardId: z.number(),
				rank: z.number(),
				ranklevel: z.number(),
				wins: z.number(),
				losses: z.number(),
				steamId: z.string()
			})
		),
		elo: z.array(
			z.object({
				matchKey: z.string(),
				raceKey: z.string(),
				rating: z.number(),
				steamId: z.string()
			})
		)
	}),
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
	}),
	headToHead: headToHeadSchema
}) satisfies z.ZodType<Compare, unknown>;

export class CompareApi {
	constructor(private deps: ApiDeps) {}

	get(options: { them: string | number; steamIds?: string[] }): ResultAsync<Compare, ApiError> {
		const params = new URLSearchParams({ them: String(options.them) });
		if (options.steamIds?.length) {
			params.set('steamIds', options.steamIds.join(','));
		}

		return ResultAsync.fromPromise(
			sendV1<unknown>(this.deps, `/compare?${params}`, { timeoutMs: 30_000 }),
			() => apiError(500, 'Failed to load comparison.')
		).andThen((value) => {
			const parsed = compareSchema.safeParse(value);
			if (!parsed.success) {
				return err(apiError(500, 'Failed to load comparison.'));
			}

			return ok<Compare, ApiError>(parsed.data);
		});
	}
}
