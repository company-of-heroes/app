import type { ListResult, RecordModel } from 'pocketbase';
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type {
	HistoryMapOption,
	HistoryMatchup,
	ReplaysQuery
} from '@company-of-heroes/ui/replay/types';
import type {
	LiveLobbyPlayer,
	LiveLobbyPlayerStats
} from '@company-of-heroes/ui/live-lobby/types';
import { normalizeBaseUrl, resolveAuthHeaders, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { currentUserId, fromPbPromise, pbOptions } from '../pb';

export type {
	HistoryMapOption,
	HistoryMatchup,
	ReplaysQuery
} from '@company-of-heroes/ui/replay/types';

export const REPLAYS_PER_PAGE = 30;

export const HISTORY_MATCHUP_TYPES: Record<HistoryMatchup, readonly number[]> = {
	'1v1': [1],
	'2v2': [2, 5],
	'3v3': [3, 6],
	'4v4': [4, 7]
};

export type CommunityPlayer = {
	playerId: number | null;
	steamId: string | null;
	race: number | null;
	likeCount?: number;
	/** Replay faction id (member uploads), e.g. allies_commonwealth. */
	faction?: string;
	/** Doctrine label from the .rec (member uploads). */
	doctrineName?: string;
	/** Ladder stats when available on list/detail responses. */
	stats?: LiveLobbyPlayerStats | null;
	profile: {
		profile_id: number;
		alias: string;
	};
};

export type MatchResultPlayer = {
	profile_id: number;
	alias?: string;
	steamId?: string;
	name?: string;
	teamid?: number;
	race_id?: number;
	wins?: number;
	losses?: number;
	streak?: number;
	outcome?: number;
	oldrating?: number;
	newrating?: number;
	country?: string;
};

export type MatchResult = {
	description?: string;
	matchtype_id?: number;
	startgametime?: number;
	completiontime?: number;
	players?: MatchResultPlayer[];
} | null;

export type CommunityMatch = {
	id: string;
	map: string;
	title: string;
	result: MatchResult;
	createdAt: string;
	isRanked: boolean;
	hasReplay: boolean;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	players: CommunityPlayer[];
	kind?: 'match' | 'member';
	durationSeconds?: number | null;
	description?: string;
	uploadedBy?: MemberReplayUploader | null;
	visibility?: 'private' | 'member' | 'deleted';
};

export type CommunityMatchList = {
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
	items: CommunityMatch[];
};

export type CommunityMatchSubmittedBy = {
	alias: string;
	profileId: number;
	steamId?: string | null;
};

export type MemberReplayUploader = {
	id: string;
	alias: string;
};

export type CommunityMatchDetail = {
	id: string;
	map: string;
	title: string;
	isRanked: boolean;
	createdAt: string;
	durationSeconds: number | null;
	likeCount: number;
	downloadCount: number;
	replay: string;
	hasReplay?: boolean;
	needsResult?: boolean;
	sessionId?: number;
	hidden?: boolean;
	hiddenByKeyword?: boolean;
	submittedBy?: CommunityMatchSubmittedBy | null;
	updatedAt?: string;
	owner?: string | null;
	players: CommunityPlayer[];
	livePlayers?: LiveLobbyPlayer[] | null;
	result: MatchResult;
	kind?: 'match' | 'member';
	description?: string;
	uploadedBy?: MemberReplayUploader | null;
	filename?: string;
	mapFilename?: string;
	visibility?: 'private' | 'member' | 'deleted';
	/** Raw replay roster (member detail) for owner edits. */
	roster?: unknown[];
	/** Linked member replay when this lobby was published from a community match. */
	memberReplayId?: string | null;
	/** True when the authenticated user owns this lobby and can publish it. */
	canPublish?: boolean;
};

export type PublishFromMatchInput = {
	title?: string;
	description: string;
	durationInSeconds?: number;
	players?: unknown;
};

export type MemberReplayList = CommunityMatchList;
export type MemberReplayDetail = CommunityMatchDetail;

export type MemberReplayStatsPreview = {
	matchtype_id: number;
	players: MatchResultPlayer[];
	livePlayers: LiveLobbyPlayer[];
};

export type MemberReplayUploadInput = {
	file: Blob;
	filename: string;
	title: string;
	description: string;
	mapName: string;
	mapFilename: string;
	durationInSeconds: number;
	gameDate?: string;
	isRanked?: boolean;
	isVpGame?: boolean;
	isRandomStart?: boolean;
	isHighResources?: boolean;
	vpCount?: number;
	players: unknown;
	messages?: unknown;
};

export type ReplayCatalogRecord = RecordModel & {
	title?: string;
	filename?: string;
	file?: string;
	mapName?: string;
	mapFilename?: string;
	createdBy?: string;
	visibility?: 'private' | 'member' | 'deleted';
	description?: string;
	likeCount?: number;
	downloadCount?: number;
	commentCount?: number;
};

export type MemberReplayUpdateInput = {
	title?: string;
	description?: string;
	players?: unknown;
};

/** Editable roster row for member replay upload/edit (raw .rec player shape). */
export type MemberReplayRosterPlayer = {
	name?: string;
	alias?: string;
	faction?: string;
	steamId?: string | null;
	doctrineName?: string;
	id?: number;
};

function parseJsonArray(raw: unknown): unknown[] {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function rosterPlayerFromUnknown(raw: unknown, index: number): MemberReplayRosterPlayer {
	const player =
		raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
	const profile =
		player.profile && typeof player.profile === 'object'
			? (player.profile as Record<string, unknown>)
			: null;
	const name = String(
		player.name || player.alias || profile?.alias || `Player ${index + 1}`
	).trim();
	const steamRaw = player.steamId;
	const steamId =
		steamRaw != null && String(steamRaw).trim() ? String(steamRaw).trim() : undefined;
	const faction = player.faction != null ? String(player.faction) : undefined;
	const doctrineName = player.doctrineName != null ? String(player.doctrineName) : undefined;
	const idRaw = player.id ?? player.playerId ?? profile?.profile_id;
	const idNum = Number(idRaw);
	const id = Number.isFinite(idNum) && idNum > 0 ? idNum : undefined;

	return {
		name,
		alias: name,
		faction,
		steamId,
		doctrineName,
		id
	};
}

/**
 * Build an editable roster from member detail (`roster` preferred, else community `players`).
 */
export function memberReplayRosterForEdit(match: {
	roster?: unknown;
	players?: unknown;
}): MemberReplayRosterPlayer[] {
	const fromRoster = parseJsonArray(match.roster).map(rosterPlayerFromUnknown);
	if (fromRoster.length > 0) {
		return fromRoster;
	}

	return parseJsonArray(match.players).map(rosterPlayerFromUnknown);
}

export function matchtypesForMatchups(matchups: string[]): number[] {
	const ids = new Set<number>();
	for (const matchup of matchups) {
		const types = HISTORY_MATCHUP_TYPES[matchup as HistoryMatchup];
		if (!types) {
			continue;
		}

		for (const id of types) {
			ids.add(id);
		}
	}

	return [...ids];
}

/** CoH slots are team-interleaved; UI position N maps to both teams. Stored slots are 1-based. */
export function slotsForPositions(positions: string[]): number[] {
	const slots = new Set<number>();
	for (const value of positions) {
		const position = Number(value);
		if (!Number.isInteger(position) || position < 1 || position > 4) {
			continue;
		}

		slots.add((position - 1) * 2 + 1);
		slots.add((position - 1) * 2 + 2);
	}

	return [...slots];
}

export type MatchHistoryScopeOptions = {
	scope?: 'community' | 'user';
	userId?: string;
	profileId?: number;
};

export function buildMatchHistoryUrl(
	baseUrl: string,
	query: ReplaysQuery,
	perPage = REPLAYS_PER_PAGE,
	options?: MatchHistoryScopeOptions
): string {
	const scope = options?.scope ?? 'community';
	const params = new URLSearchParams({
		scope,
		page: String(query.page),
		perPage: String(perPage)
	});
	if (scope === 'user' && options?.userId) {
		params.set('userId', options.userId);
	}

	if (scope === 'user' && options?.profileId != null && options.profileId > 0) {
		params.set('profileId', String(options.profileId));
	}

	if (query.ranked) {
		params.set('ranked', 'true');
	}

	if (query.pro) {
		params.set('pro', 'true');
	}

	const matchtypes = matchtypesForMatchups(query.matchups);
	if (matchtypes.length > 0) {
		params.set('matchtypes', matchtypes.join(','));
	}

	if (query.playerIds.length > 0) {
		params.set('playerIds', query.playerIds.join(','));
	}

	if (query.maps.length > 0) {
		params.set('maps', query.maps.join(','));
	}

	if (query.races.length > 0) {
		params.set('races', query.races.join(','));
	}

	const slots = slotsForPositions(query.positions);
	if (slots.length > 0) {
		params.set('slots', slots.join(','));
	}

	if (query.elo) {
		params.set('eloOp', query.elo.op);
		params.set('elo', String(query.elo.value));
	}

	if (query.duration) {
		params.set('durationOp', query.duration.op);
		params.set('duration', String(query.duration.value * 60));
	}

	if (query.sort !== 'createdAt') {
		params.set('sort', query.sort);
		params.set('sortDir', query.sortDir);
	} else if (query.sortDir === 'asc') {
		params.set('sort', 'createdAt');
		params.set('sortDir', 'asc');
	}

	return `${normalizeBaseUrl(baseUrl)}/api/match-history?${params.toString()}`;
}

export function matchFileUrl(
	baseUrl: string,
	match: Pick<CommunityMatchDetail, 'id' | 'replay' | 'kind'>
): string | null {
	if (!match.replay) {
		return null;
	}

	const collection = match.kind === 'member' ? 'replays' : 'lobbies';
	return `${normalizeBaseUrl(baseUrl)}/api/files/${collection}/${match.id}/${encodeURIComponent(match.replay)}`;
}

export function buildMemberReplaysUrl(
	baseUrl: string,
	query: ReplaysQuery,
	perPage = REPLAYS_PER_PAGE
): string {
	const params = new URLSearchParams({
		page: String(query.page),
		perPage: String(perPage)
	});
	if (query.ranked) {
		params.set('ranked', 'true');
	}

	if (query.maps.length > 0) {
		params.set('maps', query.maps.join(','));
	}

	if (query.sort !== 'createdAt') {
		params.set('sort', query.sort);
		params.set('sortDir', query.sortDir);
	} else if (query.sortDir === 'asc') {
		params.set('sort', 'createdAt');
		params.set('sortDir', 'asc');
	}

	return `${normalizeBaseUrl(baseUrl)}/api/member-replays?${params.toString()}`;
}

const communityMatchListSchema: z.ZodType<CommunityMatchList> = z
	.object({
		page: z.number(),
		perPage: z.number(),
		totalItems: z.number(),
		totalPages: z.number(),
		items: z.array(z.any())
	})
	.passthrough() as z.ZodType<CommunityMatchList>;

const communityMatchDetailSchema: z.ZodType<CommunityMatchDetail> = z
	.object({
		id: z.string(),
		map: z.string(),
		title: z.string().optional().default(''),
		isRanked: z.boolean(),
		createdAt: z.string(),
		durationSeconds: z.number().nullable().optional().default(null),
		likeCount: z.number().optional().default(0),
		downloadCount: z.number().optional().default(0),
		replay: z.string().optional().default(''),
		hasReplay: z.boolean().optional(),
		needsResult: z.boolean().optional(),
		sessionId: z.number().optional(),
		hidden: z.boolean().optional(),
		hiddenByKeyword: z.boolean().optional(),
		submittedBy: z.any().optional().nullable(),
		updatedAt: z.string().optional(),
		owner: z.string().nullable().optional(),
		players: z.array(z.any()).optional().default([]),
		livePlayers: z.any().optional().nullable(),
		result: z.any().nullable().optional(),
		kind: z.enum(['match', 'member']).optional(),
		description: z.string().optional(),
		uploadedBy: z.any().optional().nullable(),
		filename: z.string().optional(),
		mapFilename: z.string().optional(),
		visibility: z.enum(['private', 'member', 'deleted']).optional(),
		roster: z.array(z.any()).optional(),
		memberReplayId: z.string().nullable().optional(),
		canPublish: z.boolean().optional()
	})
	.passthrough() as z.ZodType<CommunityMatchDetail>;

const historyMapsSchema = z.object({
	items: z
		.array(
			z.object({
				map: z.string(),
				name: z.string()
			})
		)
		.optional()
});

const downloadSchema = z.object({
	counted: z.boolean().optional()
});

export type ReplayAuthOptions = {
	headers?: Record<string, string>;
};

export class ReplaysApi {
	constructor(private deps: ApiDeps) {}

	getHistory(
		query: ReplaysQuery,
		perPage?: number,
		options?: MatchHistoryScopeOptions
	): ResultAsync<CommunityMatchList, ApiError> {
		const scope = options?.scope ?? 'community';
		return fetchJson(
			this.deps.fetch,
			buildMatchHistoryUrl(this.deps.baseUrl, query, perPage, options),
			{
				fallback:
					scope === 'user'
						? 'Failed to load your matches. Please try again later.'
						: 'Failed to load community replays. Please try again later.',
				schema: communityMatchListSchema
			}
		);
	}

	getMemberHistory(
		query: ReplaysQuery,
		perPage?: number,
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayList, ApiError> {
		return fetchJson(
			this.deps.fetch,
			buildMemberReplaysUrl(this.deps.baseUrl, query, perPage),
			{
				fallback: 'Failed to load member replays. Please try again later.',
				schema: communityMatchListSchema,
				init: {
					headers: resolveAuthHeaders(this.deps, options?.headers)
				}
			}
		);
	}

	getMaps(options?: MatchHistoryScopeOptions): ResultAsync<HistoryMapOption[], ApiError> {
		const scope = options?.scope ?? 'community';
		const params = new URLSearchParams({
			scope,
			limit: '100'
		});
		if (scope === 'user' && options?.userId) {
			params.set('userId', options.userId);
		}

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/history-maps?${params.toString()}`,
			{
				fallback: 'Failed to load maps.',
				schema: historyMapsSchema
			}
		)
			.map((data) => data.items ?? [])
			.orElse(() => ok([] as HistoryMapOption[]));
	}

	getMemberMaps(): ResultAsync<HistoryMapOption[], ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/maps`,
			{
				fallback: 'Failed to load maps.',
				schema: historyMapsSchema
			}
		)
			.map((data) => data.items ?? [])
			.orElse(() => ok([] as HistoryMapOption[]));
	}

	previewMemberStats(
		input: {
			players: unknown;
			isRanked: boolean;
			durationInSeconds?: number;
		},
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayStatsPreview, ApiError> {
		const schema = z.object({
			matchtype_id: z.number(),
			players: z.array(z.any()),
			livePlayers: z.array(z.any()).optional().default([])
		});

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/preview-stats`,
			{
				fallback: 'Failed to preview replay stats.',
				schema,
				timeoutMs: 60_000,
				init: {
					method: 'POST',
					headers: {
						...resolveAuthHeaders(this.deps, options?.headers),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						players: input.players,
						isRanked: input.isRanked,
						durationInSeconds: input.durationInSeconds ?? 0
					})
				},
				onStatus: (status) => {
					if (status === 401) {
						return apiError(401, 'Sign in to upload a member replay.');
					}
				}
			}
		).map((data) => ({
			matchtype_id: data.matchtype_id,
			players: data.players as MatchResultPlayer[],
			livePlayers: (data.livePlayers ?? []) as LiveLobbyPlayer[]
		}));
	}

	get(id: string, options?: ReplayAuthOptions): ResultAsync<CommunityMatchDetail, ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/match/${encodeURIComponent(id)}`,
			{
				fallback: 'Failed to load this replay. Please try again later.',
				schema: communityMatchDetailSchema,
				init: {
					headers: resolveAuthHeaders(this.deps, options?.headers)
				},
				onStatus: (status) => {
					if (status === 404) {
						return apiError(404, 'That replay is not available.');
					}
				}
			}
		).andThen((match) => {
			const hasReplay = match.hasReplay ?? Boolean(match.replay);
			const inProgress = match.needsResult === true;
			if (!hasReplay && !inProgress) {
				return errAsync(apiError(404, 'That replay is not available.'));
			}

			return ok({
				...match,
				kind: match.kind ?? 'match',
				hasReplay,
				needsResult: inProgress
			});
		});
	}

	getMember(
		id: string,
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayDetail, ApiError> {
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/${encodeURIComponent(id)}`,
			{
				fallback: 'Failed to load this replay. Please try again later.',
				schema: communityMatchDetailSchema,
				init: {
					headers: resolveAuthHeaders(this.deps, options?.headers)
				},
				onStatus: (status) => {
					if (status === 404) {
						return apiError(404, 'That replay is not available.');
					}
				}
			}
		).map((match) => ({
			...match,
			kind: 'member' as const,
			hasReplay: true
		}));
	}

	/** Resolve a public replay id as a community match or member upload. */
	getAny(id: string, options?: ReplayAuthOptions): ResultAsync<CommunityMatchDetail, ApiError> {
		const fulfill = (result: ResultAsync<CommunityMatchDetail, ApiError>) =>
			result.match(
				(value) => Promise.resolve(value),
				(error) => Promise.reject(error)
			);

		// Race both lookups so member ids are not delayed by a community 404 first.
		return ResultAsync.fromPromise(
			Promise.any([fulfill(this.get(id, options)), fulfill(this.getMember(id, options))]),
			(reason) => {
				if (reason instanceof AggregateError) {
					const errors = reason.errors as ApiError[];
					return errors.find((error) => error.status !== 404) ?? errors[0]!;
				}

				return (reason as ApiError) ?? apiError(404, 'That replay is not available.');
			}
		);
	}

	download(
		id: string,
		options?: ReplayAuthOptions & { visitorId?: string; clientIp?: string }
	): ResultAsync<{ counted: boolean }, ApiError> {
		const headers = resolveAuthHeaders(this.deps, {
			'Content-Type': 'application/json',
			...(options?.visitorId ? { 'X-Download-Visitor': options.visitorId } : {}),
			...(options?.clientIp ? { 'X-Client-IP': options.clientIp } : {}),
			...options?.headers
		});

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/match/${encodeURIComponent(id)}/download`,
			{
				fallback: 'Failed to record replay download.',
				schema: downloadSchema,
				init: {
					method: 'POST',
					headers
				}
			}
		).map((data) => ({ counted: Boolean(data.counted) }));
	}

	downloadMember(
		id: string,
		options?: ReplayAuthOptions & { visitorId?: string; clientIp?: string }
	): ResultAsync<{ counted: boolean }, ApiError> {
		const headers = resolveAuthHeaders(this.deps, {
			'Content-Type': 'application/json',
			...(options?.visitorId ? { 'X-Download-Visitor': options.visitorId } : {}),
			...(options?.clientIp ? { 'X-Client-IP': options.clientIp } : {}),
			...options?.headers
		});

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/${encodeURIComponent(id)}/download`,
			{
				fallback: 'Failed to record replay download.',
				schema: downloadSchema,
				init: {
					method: 'POST',
					headers
				}
			}
		).map((data) => ({ counted: Boolean(data.counted) }));
	}

	uploadMember(
		input: MemberReplayUploadInput,
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayDetail, ApiError> {
		// Re-wrap as a fresh File from raw bytes. Some runtimes stringify a File
		// proxy to "[object Object]" when appending to FormData for a proxied fetch.
		return ResultAsync.fromPromise(input.file.arrayBuffer(), () =>
			apiError(400, 'Invalid replay upload.')
		).andThen((buffer) => {
			const bytes = new Uint8Array(buffer);
			if (bytes.byteLength < 64) {
				return errAsync(apiError(400, 'Invalid replay upload.'));
			}

			const formData = new FormData();
			formData.append(
				'file',
				new File([bytes], input.filename, { type: 'application/octet-stream' })
			);
			formData.append('filename', input.filename);
			formData.append('title', input.title || '-');
			formData.append('description', input.description);
			formData.append('mapName', input.mapName);
			formData.append('mapFilename', input.mapFilename);
			formData.append('durationInSeconds', String(input.durationInSeconds));
			if (input.gameDate) {
				formData.append('gameDate', input.gameDate);
			}
			formData.append('isRanked', String(Boolean(input.isRanked)));
			formData.append('isVpGame', String(Boolean(input.isVpGame)));
			formData.append('isRandomStart', String(Boolean(input.isRandomStart)));
			formData.append('isHighResources', String(Boolean(input.isHighResources)));
			formData.append('vpCount', String(input.vpCount ?? 0));
			formData.append('players', JSON.stringify(input.players ?? []));
			formData.append('messages', JSON.stringify(input.messages ?? []));

			return fetchJson(
				this.deps.fetch,
				`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays`,
				{
					fallback: 'Failed to upload replay.',
					schema: communityMatchDetailSchema,
					timeoutMs: 120_000,
					init: {
						method: 'POST',
						headers: resolveAuthHeaders(this.deps, options?.headers),
						body: formData
					},
					onStatus: (status) => {
						if (status === 401) {
							return apiError(401, 'Sign in to upload a member replay.');
						}
						if (status === 400) {
							return apiError(400, 'Invalid replay upload.');
						}
					}
				}
			).map((match) => ({
				...match,
				kind: 'member' as const,
				hasReplay: true
			}));
		});
	}

	updateMember(
		id: string,
		input: MemberReplayUpdateInput,
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayDetail, ApiError> {
		const body: Record<string, unknown> = {};
		if (input.title !== undefined) {
			body.title = input.title;
		}
		if (input.description !== undefined) {
			body.description = input.description;
		}
		if (input.players !== undefined) {
			body.players = input.players;
		}

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/${encodeURIComponent(id)}`,
			{
				fallback: 'Failed to update replay.',
				schema: communityMatchDetailSchema,
				timeoutMs: 60_000,
				init: {
					method: 'PATCH',
					headers: {
						...resolveAuthHeaders(this.deps, options?.headers),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(body)
				},
				onStatus: (status) => {
					if (status === 401) {
						return apiError(401, 'Sign in to edit a member replay.');
					}
					if (status === 403) {
						return apiError(403, 'You can only edit your own uploads.');
					}
					if (status === 404) {
						return apiError(404, 'Replay not found');
					}
					if (status === 400) {
						return apiError(400, 'Invalid replay update.');
					}
				}
			}
		).map((match) => ({
			...match,
			kind: 'member' as const,
			hasReplay: true
		}));
	}

	deleteMember(
		id: string,
		options?: ReplayAuthOptions
	): ResultAsync<{ id: string; visibility: 'deleted' }, ApiError> {
		// Soft-delete via PATCH on the same path as update (avoids a separate /delete route).
		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/${encodeURIComponent(id)}`,
			{
				fallback: 'Failed to delete replay.',
				schema: z
					.object({
						id: z.string(),
						visibility: z.literal('deleted')
					})
					.passthrough(),
				init: {
					method: 'PATCH',
					headers: {
						...resolveAuthHeaders(this.deps, options?.headers),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ visibility: 'deleted' })
				},
				onStatus: (status) => {
					if (status === 401) {
						return apiError(401, 'Sign in to delete a member replay.');
					}
					if (status === 403) {
						return apiError(403, 'You can only delete your own uploads.');
					}
					if (status === 404) {
						return apiError(404, 'Replay not found');
					}
					if (status === 400) {
						return apiError(400, 'Invalid replay update.');
					}
				}
			}
		).map((match) => ({
			id: match.id,
			visibility: 'deleted' as const
		}));
	}

	publish(id: string, description?: string): ResultAsync<ReplayCatalogRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('replays').update<ReplayCatalogRecord>(
				id,
				{
					visibility: 'member',
					...(description != null ? { description } : {})
				},
				pbOptions(this.deps)
			),
			'Failed to publish replay.'
		);
	}

	publishFromMatch(
		lobbyId: string,
		input: PublishFromMatchInput = {},
		options?: ReplayAuthOptions
	): ResultAsync<MemberReplayDetail, ApiError> {
		const body: Record<string, unknown> = {};
		if (input.title !== undefined) {
			body.title = input.title;
		}
		body.description = input.description;
		if (input.durationInSeconds !== undefined) {
			body.durationInSeconds = input.durationInSeconds;
		}
		if (input.players !== undefined) {
			body.players = input.players;
		}

		return fetchJson(
			this.deps.fetch,
			`${normalizeBaseUrl(this.deps.baseUrl)}/api/member-replays/from-match/${encodeURIComponent(lobbyId)}/publish`,
			{
				fallback: 'Failed to publish replay.',
				schema: communityMatchDetailSchema,
				timeoutMs: 120_000,
				init: {
					method: 'POST',
					headers: {
						...resolveAuthHeaders(this.deps, options?.headers),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(body)
				},
				onStatus: (status) => {
					if (status === 401) {
						return apiError(401, 'Sign in to publish a member replay.');
					}
					if (status === 403) {
						return apiError(403, 'You can only publish your own matches.');
					}
					if (status === 404) {
						return apiError(404, 'Match not found');
					}
					if (status === 400) {
						return apiError(400, 'This match has no replay file.');
					}
					if (status === 409) {
						return apiError(409, 'This match is already published.');
					}
				}
			}
		).map((match) => ({
			...match,
			kind: 'member' as const,
			hasReplay: true
		}));
	}

	unpublish(id: string): ResultAsync<ReplayCatalogRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('replays').update<ReplayCatalogRecord>(
				id,
				{ visibility: 'private' },
				pbOptions(this.deps)
			),
			'Failed to unpublish replay.'
		);
	}

	getPaginated(
		page = 1,
		perPage = 50,
		options: { filter?: string; fields?: string[]; sort?: string } = {}
	): ResultAsync<ListResult<ReplayCatalogRecord>, ApiError> {
		const { filter = '', fields = [], sort = '-gameDate' } = options;
		return fromPbPromise(
			this.deps.pocketbase.collection('replays').getList<ReplayCatalogRecord>(page, perPage, pbOptions(this.deps, {
				filter,
				fields: fields.length > 0 ? fields.join(',') : undefined,
				sort,
				expand: 'createdBy'
			})),
			'Failed to load replays.'
		);
	}

	getById(id: string): ResultAsync<ReplayCatalogRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('replays').getOne<ReplayCatalogRecord>(
				id,
				pbOptions(this.deps, { expand: 'createdBy' })
			),
			'Failed to load replay.'
		);
	}

	getExistingFilenamesByUser(): ResultAsync<string[], ApiError> {
		const userId = currentUserId(this.deps);
		if (!userId) {
			return okAsync([]);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('replays').getFullList(
				pbOptions(this.deps, {
					filter: `createdBy = "${userId}"`,
					fields: 'filename',
					requestKey: null
				})
			),
			'Failed to load replays.'
		).map((records) => records.map((record) => String(record.filename ?? '')).filter(Boolean));
	}

	getMine(
		page = 1,
		perPage = 30
	): ResultAsync<ListResult<ReplayCatalogRecord>, ApiError> {
		const userId = currentUserId(this.deps);
		if (!userId) {
			return errAsync(apiError(401, 'Sign in to view your replays.'));
		}

		return this.getPaginated(page, perPage, {
			filter: `createdBy = "${userId}"`,
			sort: '-createdAt'
		});
	}
}
