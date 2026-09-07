import { z } from 'zod';
import { normalizeBaseUrl, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { ResultAsync } from 'neverthrow';
import type { LeaderboardStat, PlayerEloMap, PlayerPerformance } from '@company-of-heroes/ui/player/types';
import { emptyPlayerPerformance } from '../player-performance/player-performance';

export type PlayerCompareSide = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	leaderboardStats: LeaderboardStat[];
	elo: PlayerEloMap;
	performance: PlayerPerformance;
};

export type PlayerCompareH2hRow = {
	played: number;
	winsLeft: number;
	winsRight: number;
};

export type PlayerCompareH2hMode = PlayerCompareH2hRow & { matchtypeId: number };
export type PlayerCompareH2hMap = PlayerCompareH2hRow & { map: string };

export type PlayerCompareH2hRecent = {
	lobbyId: string;
	sessionId: number;
	map: string;
	matchtypeId: number;
	leftOutcome: 0 | 1;
	rightOutcome: 0 | 1;
};

export type PlayerCompareH2h = {
	played: number;
	winsLeft: number;
	winsRight: number;
	together: number;
	byMode: PlayerCompareH2hMode[];
	byMap: PlayerCompareH2hMap[];
	recent: PlayerCompareH2hRecent[];
};

export type PlayerCompareResult = {
	left: PlayerCompareSide;
	right: PlayerCompareSide;
	h2h: PlayerCompareH2h;
};

export type PlayerH2hRecord = {
	played: number;
	wins: number;
	losses: number;
};

export type PlayerH2hBatchResult = {
	a: number;
	records: Record<string, PlayerH2hRecord>;
};

export function emptyPlayerCompareH2h(): PlayerCompareH2h {
	return {
		played: 0,
		winsLeft: 0,
		winsRight: 0,
		together: 0,
		byMode: [],
		byMap: [],
		recent: []
	};
}

const compareSideSchema: z.ZodType<PlayerCompareSide> = z
	.object({
		steamId: z.string(),
		profileId: z.number(),
		alias: z.string(),
		country: z.string().nullable(),
		level: z.number(),
		avatarUrl: z.string(),
		leaderboardStats: z.array(z.any()),
		elo: z.record(z.string(), z.any()).default({}),
		performance: z.any().default(emptyPlayerPerformance())
	})
	.passthrough() as z.ZodType<PlayerCompareSide>;

const h2hSchema: z.ZodType<PlayerCompareH2h> = z
	.object({
		played: z.number(),
		winsLeft: z.number(),
		winsRight: z.number(),
		together: z.number(),
		byMode: z.array(z.any()).default([]),
		byMap: z.array(z.any()).default([]),
		recent: z.array(z.any()).default([])
	})
	.passthrough() as z.ZodType<PlayerCompareH2h>;

const compareResultSchema: z.ZodType<PlayerCompareResult> = z.object({
	left: compareSideSchema,
	right: compareSideSchema,
	h2h: h2hSchema
});

const h2hBatchSchema: z.ZodType<PlayerH2hBatchResult> = z.object({
	a: z.number(),
	records: z.record(
		z.string(),
		z.object({
			played: z.number(),
			wins: z.number(),
			losses: z.number()
		})
	)
});

export class PlayerCompareApi {
	constructor(private deps: ApiDeps) {}

	compare(a: number, b: number): ResultAsync<PlayerCompareResult, ApiError> {
		const params = new URLSearchParams({
			a: String(a),
			b: String(b)
		});

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/player-compare?${params}`,
			{
				fallback: 'Failed to compare players. Please try again later.',
				schema: compareResultSchema,
				onStatus: (status) => {
					if (status === 404) {
						return apiError(404, 'Player not found.');
					}
					if (status === 400) {
						return apiError(400, 'Select two different players to compare.');
					}
				}
			}
		);
	}

	h2hBatch(a: number, vs: number[]): ResultAsync<PlayerH2hBatchResult, ApiError> {
		const ids = vs.filter((id) => Number.isInteger(id) && id > 0 && id !== a).slice(0, 16);
		const params = new URLSearchParams({
			a: String(a),
			vs: ids.join(',')
		});

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/player-compare/h2h?${params}`,
			{
				fallback: 'Failed to load head-to-head records.',
				schema: h2hBatchSchema,
				onStatus: (status) => {
					if (status === 400) {
						return apiError(400, 'Invalid head-to-head request.');
					}
				}
			}
		);
	}
}
