import { ok, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { type ApiDeps, normalizeBaseUrl, resolveAuthHeaders, v1Base } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';

export type SmurfWatchStatus =
	| 'pending_screening'
	| 'watching'
	| 'resolved'
	| 'not_smurf'
	| 'expired'
	| 'unknown_private';
export type SmurfWatchSource = 'profile' | 'search' | 'lobby_live' | 'lobby_match' | 'backfill';
export type SmurfLenderSource = 'live' | 'cohstats'; // cohstats is legacy read-only
export type SmurfVerdict = 'confirmed_shared' | 'likely_smurf' | 'suspicious' | 'clean' | 'unknown';

export type SmurfWatchRecord = {
	id: string;
	steam_id: string;
	profile_id?: number;
	status: SmurfWatchStatus;
	source?: SmurfWatchSource;
	lender_steam_id?: string | null;
	lender_source?: SmurfLenderSource | null;
	owns_coh?: boolean | null;
	next_check_at?: string;
	smurf_score?: number | null;
	verdict?: SmurfVerdict | null;
	signals?: { id: string; points: number; detail: string }[] | null;
	suspected_main_steam_id?: string | null;
	main_confidence?: number | null;
	score_computed_at?: string | null;
};

const smurfWatchSchema: z.ZodType<SmurfWatchRecord> = z
	.object({
		id: z.string(),
		steam_id: z.string(),
		profile_id: z.number().optional(),
		status: z.string(),
		source: z.string().optional(),
		lender_steam_id: z.string().nullable().optional(),
		lender_source: z.string().nullable().optional(),
		owns_coh: z.boolean().nullable().optional(),
		next_check_at: z.string().optional(),
		smurf_score: z.number().nullable().optional(),
		verdict: z.string().nullable().optional(),
		signals: z
			.array(
				z.object({
					id: z.string(),
					points: z.number(),
					detail: z.string()
				})
			)
			.nullable()
			.optional(),
		suspected_main_steam_id: z.string().nullable().optional(),
		main_confidence: z.number().nullable().optional(),
		score_computed_at: z.string().nullable().optional()
	})
	.passthrough() as z.ZodType<SmurfWatchRecord>;

export class SmurfWatchApi {
	constructor(private deps: ApiDeps) {}

	get(steamId: string): ResultAsync<SmurfWatchRecord | null, ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${v1Base(this.deps)}/smurf-watch/${encodeURIComponent(steamId)}`,
			{
				fallback: 'Failed to load smurf watch.',
				schema: smurfWatchSchema,
				onStatus: (status) => {
					if (status === 404) {
						return apiError(404, 'Smurf watch not found.');
					}
				}
			}
		).orElse(() => ok(null));
	}

	enqueue(input: {
		steamId: string;
		profileId?: number;
		source: SmurfWatchSource;
		priority?: number;
	}): ResultAsync<void, ApiError> {
		return ResultAsync.fromPromise(
			this.deps.fetch(`${v1Base(this.deps)}/smurf-watch/enqueue`, {
				method: 'POST',
				headers: resolveAuthHeaders(this.deps, { 'Content-Type': 'application/json' }),
				body: JSON.stringify({
					steam_id: input.steamId,
					profile_id: input.profileId,
					source: input.source,
					priority: input.priority
				})
			}),
			() => apiError(500, 'Failed to enqueue smurf watch.')
		)
			.map(() => undefined)
			.orElse(() => okAsync(undefined));
	}
}
