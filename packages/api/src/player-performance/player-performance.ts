import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';

export type PerformanceScope = 'user' | 'community';

export type PerformanceRecord = {
	wins: number;
	losses: number;
};

export type PerformanceMapRecord = PerformanceRecord & { map: string };
export type PerformanceFactionRecord = PerformanceRecord & { raceId: number };
export type PerformanceModeRecord = PerformanceRecord & { matchtypeId: number };

export type PerformanceRecentMatch = {
	id: string;
	sessionId: number;
	outcome: 0 | 1;
	raceId: number | null;
	matchtypeId: number | null;
};

export type PlayerPerformance = {
	matchCount: number;
	wins: number;
	losses: number;
	recentMatches: PerformanceRecentMatch[];
	byMap: PerformanceMapRecord[];
	byFaction: PerformanceFactionRecord[];
	byMode: PerformanceModeRecord[];
};

export const emptyPlayerPerformance = (): PlayerPerformance => ({
	matchCount: 0,
	wins: 0,
	losses: 0,
	recentMatches: [],
	byMap: [],
	byFaction: [],
	byMode: []
});

const CACHE_TTL_MS = 60_000;
const CACHE_VERSION = 6;
const performanceCache = new Map<string, { at: number; value: PlayerPerformance }>();

const performanceSchema: z.ZodType<PlayerPerformance> = z
	.object({
		matchCount: z.number(),
		wins: z.number(),
		losses: z.number(),
		recentMatches: z.array(z.any()),
		byMap: z.array(z.any()),
		byFaction: z.array(z.any()),
		byMode: z.array(z.any())
	})
	.passthrough() as z.ZodType<PlayerPerformance>;

function performanceCacheKey(options: {
	profileId: number;
	scope: PerformanceScope;
	userId?: string | null;
}) {
	return `${CACHE_VERSION}:${options.scope}:${options.userId ?? ''}:${options.profileId}`;
}

export function invalidatePlayerPerformanceCache(profileId?: number) {
	if (profileId == null) {
		performanceCache.clear();
		return;
	}

	const suffix = `:${profileId}`;
	for (const key of performanceCache.keys()) {
		if (key.endsWith(suffix)) {
			performanceCache.delete(key);
		}
	}
}

export class PlayerPerformanceApi {
	constructor(private deps: ApiDeps) {}

	getPlayerPerformance(options: {
		profileId: number;
		scope: PerformanceScope;
		userId?: string | null;
		fresh?: boolean;
	}): ResultAsync<PlayerPerformance, ApiError> {
		const key = performanceCacheKey(options);
		if (!options.fresh) {
			const hit = performanceCache.get(key);
			if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
				return ResultAsync.fromSafePromise(Promise.resolve(hit.value));
			}
		}

		const query: Record<string, string> = {
			profileId: String(options.profileId),
			scope: options.scope
		};
		if (options.scope === 'user' && options.userId) {
			query.userId = options.userId;
		}

		if (options.fresh) {
			query.fresh = '1';
		}

		return ResultAsync.fromPromise(
			this.deps.pocketbase.send<PlayerPerformance>('/api/player-performance', {
				method: 'GET',
				query,
				fetch: this.deps.fetch
			}),
			() => apiError(500, 'Failed to load player performance.')
		).andThen((value) => {
			const parsed = performanceSchema.safeParse(value);
			if (!parsed.success) {
				return err(apiError(500, 'Failed to load player performance.'));
			}

			performanceCache.set(key, { at: Date.now(), value: parsed.data });
			return ok(parsed.data);
		});
	}
}
