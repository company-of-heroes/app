import { ok, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { getStoredEloForLeaderboard } from '@company-of-heroes/ui/format/player-format';
import type { PlayerEloMap } from '@company-of-heroes/ui/format/types';
import type { TransformedMatch } from '@company-of-heroes/ui/player/types';
import { type ApiDeps, normalizeBaseUrl, resolveAuthHeaders, v1Base } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { pbOptions } from '../pb';

export type PlayerEloSlot = {
	rating: number;
	matchId: number;
	at: number;
};

export type { PlayerEloMap };

export type PlayerEloSlotInput = {
	matchtypeId: number;
	raceId: number;
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerRatingSnapshot = {
	steamId: string;
	profileId: number;
	alias: string;
	slots: PlayerEloSlotInput[];
};

export type PlayerRatingRecord = {
	id: string;
	steamId: string;
	profileId: number;
	alias: string;
	elo: PlayerEloMap;
	harvestedAt?: string | null;
};

export type PlayerEloHistoryPoint = {
	at: number;
	rating: number;
	matchtypeId: number;
	raceId: number;
	matchId: number;
};

export const LEADERBOARD_ELO_STALE_MS = 6 * 60 * 60 * 1000;
export const LEADERBOARD_HARVEST_MAX = 12;
export const INGEST_BATCH_SIZE = 64;
export const STEAM_ID_REGEX = /^7656119\d{10}$/;
export const MIN_STORED_MATCH_TYPE = 0;
export const MAX_STORED_MATCH_TYPE = 7;

const ratingRecordSchema: z.ZodType<PlayerRatingRecord> = z
	.object({
		id: z.string(),
		steamId: z.string(),
		profileId: z.number(),
		alias: z.string(),
		elo: z.any().optional(),
		harvestedAt: z.string().nullable().optional()
	})
	.passthrough()
	.transform((raw) => ({
		id: raw.id,
		steamId: raw.steamId,
		profileId: raw.profileId,
		alias: raw.alias,
		elo: eloMapFromRecord(raw.elo),
		harvestedAt: raw.harvestedAt ?? null
	}));

const ingestSchema = z.object({
	players: z.array(ratingRecordSchema).optional()
});

const harvestSchema = z.object({
	processed: z.number().optional(),
	skipped: z.number().optional(),
	updated: z.number().optional()
});

const historySchema = z.object({
	points: z
		.array(
			z.object({
				at: z.number(),
				rating: z.number(),
				matchtypeId: z.number(),
				raceId: z.number(),
				matchId: z.number()
			})
		)
		.optional()
});

export function isStoredMatchType(matchtypeId: number): boolean {
	const id = Number(matchtypeId);
	return Number.isInteger(id) && id >= MIN_STORED_MATCH_TYPE && id <= MAX_STORED_MATCH_TYPE;
}

export function isValidSteamId(value: string | undefined | null): value is string {
	return typeof value === 'string' && STEAM_ID_REGEX.test(value);
}

function normalizeKeyedContainer(value: unknown): Record<string, unknown> {
	if (value == null) {
		return {};
	}

	if (Array.isArray(value)) {
		const obj: Record<string, unknown> = {};
		for (let i = 0; i < value.length; i++) {
			if (value[i] != null) {
				obj[String(i)] = value[i];
			}
		}
		return obj;
	}

	if (typeof value === 'object') {
		return value as Record<string, unknown>;
	}

	return {};
}

function keyedEntries(value: unknown): [string, unknown][] {
	return Object.entries(normalizeKeyedContainer(value));
}

function asEloSlot(value: unknown): PlayerEloSlot | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const raw = value as Record<string, unknown>;
	const rating = Number(raw.rating);
	const matchId = Number(raw.matchId ?? raw.match_id);
	const at = Number(raw.at);

	if (!Number.isFinite(rating) || rating < 1) {
		return null;
	}

	if (!Number.isFinite(matchId) || matchId <= 0) {
		return null;
	}

	if (!Number.isFinite(at) || at < 0) {
		return null;
	}

	return { rating, matchId, at };
}

export function eloMapFromRecord(elo: unknown): PlayerEloMap {
	const map: PlayerEloMap = {};

	for (const [matchKey, races] of keyedEntries(elo)) {
		for (const [raceKey, value] of keyedEntries(races)) {
			const slot = asEloSlot(value);
			if (!slot) {
				continue;
			}

			const group = map[matchKey] ?? {};
			const current = group[raceKey];
			if (!current || slot.at > current.at) {
				group[raceKey] = slot;
				map[matchKey] = group;
			}
		}
	}

	return map;
}

export function eloMapFromSlots(slots: PlayerEloSlotInput[]): PlayerEloMap {
	const elo: PlayerEloMap = {};

	for (const slot of slots) {
		const matchKey = String(slot.matchtypeId);
		const raceKey = String(slot.raceId);
		const group = elo[matchKey] ?? {};
		const current = group[raceKey];

		if (!current || slot.at > current.at) {
			group[raceKey] = {
				rating: slot.rating,
				matchId: slot.matchId,
				at: slot.at
			};
			elo[matchKey] = group;
		}
	}

	return elo;
}

function steamIdFromPlayer(player: { steamId?: string; name?: string }): string | null {
	if (isValidSteamId(player.steamId)) {
		return player.steamId;
	}

	if (typeof player.name === 'string') {
		const steamId = player.name.replace('/steam/', '');
		return isValidSteamId(steamId) ? steamId : null;
	}

	return null;
}

function slotFromMatchPlayer(
	match: TransformedMatch,
	player: TransformedMatch['players'][number]
): PlayerEloSlotInput | null {
	const matchtypeId = Number(match.matchtype_id);
	if (!isStoredMatchType(matchtypeId)) {
		return null;
	}

	const rating = Number(player.newrating);
	if (!Number.isFinite(rating) || rating < 1) {
		return null;
	}

	const raceId = Number(player.race_id);
	if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	const matchId = Number(match.id);
	if (!Number.isFinite(matchId) || matchId <= 0) {
		return null;
	}

	const at = Number(match.completiontime ?? match.startgametime ?? 0);
	if (!Number.isFinite(at) || at < 0) {
		return null;
	}

	return {
		matchtypeId,
		raceId,
		rating,
		matchId,
		at
	};
}

function upsertSnapshotSlot(snapshot: PlayerRatingSnapshot, slot: PlayerEloSlotInput): void {
	const existing = snapshot.slots.find(
		(item) => item.matchtypeId === slot.matchtypeId && item.raceId === slot.raceId
	);

	if (!existing) {
		snapshot.slots.push(slot);
		return;
	}

	if (slot.at > existing.at) {
		existing.rating = slot.rating;
		existing.matchId = slot.matchId;
		existing.at = slot.at;
	}
}

export function extractPlayerRatingSnapshots(
	matches: TransformedMatch[] | undefined
): PlayerRatingSnapshot[] {
	if (!matches?.length) {
		return [];
	}

	const bySteamId = new Map<string, PlayerRatingSnapshot>();

	for (const match of matches) {
		if (!isStoredMatchType(Number(match.matchtype_id)) || !match.players?.length) {
			continue;
		}

		for (const player of match.players) {
			const steamId = steamIdFromPlayer(player);
			const slot = slotFromMatchPlayer(match, player);
			const alias = typeof player.alias === 'string' ? player.alias.trim() : '';
			const profileId = Number(player.profile_id);

			if (!steamId || !slot || !alias || !Number.isInteger(profileId) || profileId <= 0) {
				continue;
			}

			const existing = bySteamId.get(steamId);
			if (!existing) {
				bySteamId.set(steamId, {
					steamId,
					profileId,
					alias,
					slots: [slot]
				});
				continue;
			}

			existing.profileId = profileId;
			existing.alias = alias;
			upsertSnapshotSlot(existing, slot);
		}
	}

	return [...bySteamId.values()];
}

function isHarvestedStale(harvestedAt: string | null | undefined, staleMs: number): boolean {
	if (!harvestedAt) {
		return true;
	}

	const at = new Date(harvestedAt).getTime();
	if (!Number.isFinite(at)) {
		return true;
	}

	return Date.now() - at >= staleMs;
}

export function selectLeaderboardHarvestProfileIds(options: {
	stats: Array<{ profile: { profile_id: number }; leaderboard_id?: number }>;
	leaderboardId: number;
	ratingsBySteamId: Map<string, PlayerRatingRecord>;
	steamIdForProfile: (profileId: number) => string | null;
	staleMs?: number;
	limit?: number;
}): number[] {
	const staleMs = options.staleMs ?? LEADERBOARD_ELO_STALE_MS;
	const limit = options.limit ?? LEADERBOARD_HARVEST_MAX;
	const selected: number[] = [];

	for (const stat of options.stats) {
		if (selected.length >= limit) {
			break;
		}

		const profileId = Number(stat.profile?.profile_id);
		if (!Number.isInteger(profileId) || profileId <= 0) {
			continue;
		}

		const steamId = options.steamIdForProfile(profileId);
		const record = steamId ? options.ratingsBySteamId.get(steamId) : undefined;
		const leaderboardId = Number(stat.leaderboard_id ?? options.leaderboardId);
		const hasSlot = record != null && getStoredEloForLeaderboard(record.elo, leaderboardId) != null;
		const stale = !record || isHarvestedStale(record.harvestedAt, staleMs);

		if (!hasSlot || stale) {
			selected.push(profileId);
		}
	}

	return selected;
}

export function groupEloHistoryByModeAndRace(
	points: PlayerEloHistoryPoint[]
): Record<number, Record<number, PlayerEloHistoryPoint[]>> {
	const grouped: Record<number, Record<number, PlayerEloHistoryPoint[]>> = {};

	for (const point of points) {
		if (point.matchtypeId === 14) {
			continue;
		}

		const byRace = (grouped[point.matchtypeId] ??= {});
		const series = (byRace[point.raceId] ??= []);
		series.push(point);
	}

	for (const byRace of Object.values(grouped)) {
		for (const series of Object.values(byRace)) {
			series.sort((a, b) => a.at - b.at || a.matchId - b.matchId);
		}
	}

	return grouped;
}

export class RatingsApi {
	constructor(private deps: ApiDeps) {}

	getPlayerRating(
		steamId: string,
		options?: { fill?: boolean }
	): ResultAsync<PlayerRatingRecord | null, ApiError> {
		if (!isValidSteamId(steamId)) {
			return okAsync(null);
		}

		const fill = options?.fill ? '?fill=1' : '';
		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/player-ratings/${steamId}${fill}`, {
			fallback: 'Failed to load player rating.',
			schema: ratingRecordSchema,
			onStatus: (status) => {
				if (status === 404) {
					return apiError(404, 'Player rating not found.');
				}
			}
		}).orElse(() => ok(null));
	}

	getPlayerRatings(steamIds: string[]): ResultAsync<Map<string, PlayerRatingRecord>, ApiError> {
		const uniqueIds = [...new Set(steamIds.filter(isValidSteamId))];
		if (uniqueIds.length === 0) {
			return okAsync(new Map());
		}

		return fromSafeRatings(this.loadRatingBatches(uniqueIds));
	}

	ingest(players: PlayerRatingSnapshot[]): ResultAsync<PlayerRatingRecord[], ApiError> {
		if (players.length === 0 || !this.deps.pocketbase.authStore.isValid) {
			return okAsync([]);
		}

		return fromSafeRatings(this.ingestBatches(players));
	}

	ingestFromMatchHistory(
		matches: TransformedMatch[] | undefined
	): ResultAsync<PlayerRatingRecord[], ApiError> {
		if (!this.deps.pocketbase.authStore.isValid) {
			return okAsync([]);
		}

		const snapshots = extractPlayerRatingSnapshots(matches);
		if (snapshots.length === 0) {
			return okAsync([]);
		}

		return this.ingest(snapshots);
	}

	harvest(
		profileIds: number[]
	): ResultAsync<{ processed: number; skipped: number; updated: number } | null, ApiError> {
		const unique = [...new Set(profileIds.filter((id) => Number.isInteger(id) && id > 0))];
		if (unique.length === 0 || !this.deps.pocketbase.authStore.isValid) {
			return okAsync(null);
		}

		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/player-ratings/harvest/profiles`, {
			fallback: 'Failed to harvest player ratings.',
			schema: harvestSchema,
			init: {
				method: 'POST',
				headers: resolveAuthHeaders(this.deps, { 'Content-Type': 'application/json' }),
				body: JSON.stringify({ profileIds: unique })
			}
		})
			.map((payload) => ({
				processed: Number(payload.processed) || 0,
				skipped: Number(payload.skipped) || 0,
				updated: Number(payload.updated) || 0
			}))
			.orElse(() => ok(null));
	}

	getPlayerEloHistory(options: {
		profileId?: number | null;
		steamId?: string | null;
	}): ResultAsync<PlayerEloHistoryPoint[], ApiError> {
		const profileId = Number(options.profileId);
		const steamId = options.steamId?.trim() || '';
		const hasProfile = Number.isInteger(profileId) && profileId > 0;
		const hasSteam = isValidSteamId(steamId);

		if (!hasProfile && !hasSteam) {
			return okAsync([]);
		}

		const params = new URLSearchParams();
		if (hasProfile) {
			params.set('profileId', String(profileId));
		}

		if (hasSteam) {
			params.set('steamId', steamId);
		}

		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/player-ratings/history?${params}`, {
			fallback: 'Failed to load ELO history.',
			schema: historySchema
		})
			.map((payload) => (Array.isArray(payload.points) ? payload.points : []))
			.orElse(() => ok([]));
	}

	private async loadRatingBatches(uniqueIds: string[]): Promise<Map<string, PlayerRatingRecord>> {
		const results = new Map<string, PlayerRatingRecord>();
		const BATCH_SIZE = 40;
		const batches: string[][] = [];
		for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
			batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
		}

		const settled = await Promise.all(
			batches.map(async (batch) => {
				try {
					const filter = batch.map((id) => `steamId="${id}"`).join('||');
					return await this.deps.pocketbase
						.collection('player_ratings')
						.getFullList(pbOptions(this.deps, { filter }));
				} catch {
					return [];
				}
			})
		);

		for (const records of settled) {
			for (const record of records) {
				const parsed = ratingRecordSchema.safeParse(record);
				if (parsed.success) {
					results.set(parsed.data.steamId, parsed.data);
				}
			}
		}

		return results;
	}

	private async ingestBatches(players: PlayerRatingSnapshot[]): Promise<PlayerRatingRecord[]> {
		const records: PlayerRatingRecord[] = [];
		const headers = resolveAuthHeaders(this.deps, { 'Content-Type': 'application/json' });

		for (let i = 0; i < players.length; i += INGEST_BATCH_SIZE) {
			const batch = players.slice(i, i + INGEST_BATCH_SIZE);
			try {
				const response = await this.deps.fetch(`${v1Base(this.deps)}/player-ratings/ingest`, {
					method: 'POST',
					headers,
					body: JSON.stringify({ players: batch })
				});
				if (!response.ok) {
					continue;
				}

				const json = await response.json();
				const parsed = ingestSchema.safeParse(json);
				if (parsed.success && Array.isArray(parsed.data.players)) {
					records.push(...parsed.data.players);
				}
			} catch {
				// Soft-fail ingest batches.
			}
		}

		return records;
	}
}

function fromSafeRatings<T>(promise: Promise<T>): ResultAsync<T, ApiError> {
	return ResultAsync.fromSafePromise(promise);
}
