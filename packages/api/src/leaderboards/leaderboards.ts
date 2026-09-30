import { z } from 'zod';
import type { ResultAsync } from 'neverthrow';
import { type ApiDeps, normalizeBaseUrl, v1Base } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { PlayerEloMap } from '@company-of-heroes/ui/player/types';
import type { PlayerLabel } from '@company-of-heroes/ui/format/types';

export type RelicLeaderboardProfile = {
	profile_id: number;
	alias: string;
	country: string | null;
	name: string;
	avatarUrl?: string;
	labels?: PlayerLabel[];
};

export type LeaderboardStatWithProfile = {
	leaderboard_id: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	profile: RelicLeaderboardProfile;
};

export type LeaderboardPageData = {
	leaderboardId: number;
	stats: LeaderboardStatWithProfile[];
	eloBySteamId: Record<string, PlayerEloMap>;
};

const leaderboardSchema: z.ZodType<LeaderboardPageData> = z
	.object({
		leaderboardId: z.number(),
		stats: z.array(z.any()),
		eloBySteamId: z.record(z.string(), z.any())
	})
	.passthrough() as z.ZodType<LeaderboardPageData>;

export class LeaderboardsApi {
	constructor(private deps: ApiDeps) {}

	get(boardId: number): ResultAsync<LeaderboardPageData, ApiError> {
		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/leaderboards/${boardId}`, {
			fallback: 'Failed to load the leaderboard. Please try again later.',
			schema: leaderboardSchema,
			onStatus: (status) => {
				if (status === 400) {
					return apiError(400, 'That leaderboard is not available.');
				}
			}
		});
	}
}
