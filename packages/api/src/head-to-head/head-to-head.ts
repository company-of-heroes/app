import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';

export type HeadToHeadMatchup = {
	raceId: number;
	theirRaceId: number;
	wins: number;
	losses: number;
};

export type HeadToHeadMode = {
	matchtypeId: number;
	wins: number;
	losses: number;
};

export type HeadToHead = {
	profileId: number;
	matchCount: number;
	wins: number;
	losses: number;
	lastSessionId: number | null;
	byMatchup: HeadToHeadMatchup[];
	byMode: HeadToHeadMode[];
};

export const emptyHeadToHead = (profileId: number): HeadToHead => ({
	profileId,
	matchCount: 0,
	wins: 0,
	losses: 0,
	lastSessionId: null,
	byMatchup: [],
	byMode: []
});

const CACHE_TTL_MS = 60_000;
const headToHeadCache = new Map<string, { at: number; value: HeadToHead }>();

const headToHeadSchema: z.ZodType<HeadToHead> = z.object({
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
	)
});

const responseSchema = z.record(z.string(), headToHeadSchema);

function headToHeadCacheKey(me: number | null | undefined, profileId: number) {
	return `${me ?? ''}:${profileId}`;
}

export function invalidateHeadToHeadCache() {
	headToHeadCache.clear();
}

export class HeadToHeadApi {
	constructor(private deps: ApiDeps) {}

	get(options: {
		profileIds: number[];
		me?: number | null;
		fresh?: boolean;
	}): ResultAsync<Record<number, HeadToHead>, ApiError> {
		const profileIds = [...new Set(options.profileIds)];
		const hits: Record<number, HeadToHead> = {};
		const missing: number[] = [];
		const now = Date.now();
		for (const profileId of profileIds) {
			const hit = options.fresh
				? undefined
				: headToHeadCache.get(headToHeadCacheKey(options.me, profileId));
			if (hit && now - hit.at < CACHE_TTL_MS) {
				hits[profileId] = hit.value;
			} else {
				missing.push(profileId);
			}
		}

		if (missing.length === 0) {
			return ResultAsync.fromSafePromise(Promise.resolve(hits));
		}

		const params = new URLSearchParams({ profileIds: missing.join(',') });
		if (options.me != null) {
			params.set('me', String(options.me));
		}

		return ResultAsync.fromPromise(
			sendV1<Record<string, HeadToHead>>(this.deps, `/head-to-head?${params}`, {
				timeoutMs: 30_000
			}),
			() => apiError(500, 'Failed to load head to head.')
		).andThen((value) => {
			const parsed = responseSchema.safeParse(value);
			if (!parsed.success) {
				return err(apiError(500, 'Failed to load head to head.'));
			}

			const at = Date.now();
			const result: Record<number, HeadToHead> = { ...hits };
			for (const [key, entry] of Object.entries(parsed.data)) {
				const profileId = Number(key);
				headToHeadCache.set(headToHeadCacheKey(options.me, profileId), { at, value: entry });
				result[profileId] = entry;
			}

			return ok(result);
		});
	}
}
