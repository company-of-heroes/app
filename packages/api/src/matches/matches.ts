import type { ListResult, RecordFullListOptions, RecordModel } from 'pocketbase';
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { normalizeBaseUrl, resolveAuthHeaders, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { fromPbPromise, pbOptions, requireAuth } from '../pb';

export type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte';
export type HistorySortField = 'createdAt' | 'likeCount' | 'downloadCount' | 'commentCount';

export type HistoryListQuery = {
	scope: 'user' | 'community';
	userId?: string;
	profileId?: number;
	ranked?: boolean;
	pro?: boolean;
	playerIds?: string[];
	maps?: string[];
	races?: string[];
	matchtypes?: number[];
	exactMatchtypes?: boolean;
	slots?: number[];
	includeSkirmish?: boolean;
	eloOp?: FilterOperator;
	elo?: number;
	durationOp?: FilterOperator;
	duration?: number;
	/** Query-builder AST JSON; when set, preferred over flat filter fields. */
	filter?: unknown;
	sort?: HistorySortField;
	sortDir?: 'asc' | 'desc';
};

export type AggregationPlayer = { profile_id: number; alias: string };

export type MatchRecord = RecordModel & {
	sessionId?: number;
	map?: string;
	title?: string;
	isRanked?: boolean;
	needsResult?: boolean;
	hasReplay?: boolean;
	players?: unknown;
	result?: unknown;
	user?: string;
	memberReplay?: string;
};

export type MatchCreateInput = {
	isRanked: boolean;
	title: string;
	map: string;
	sessionId: number;
	needsResult: boolean;
	players: unknown[];
	hasReplay?: boolean;
	result?: unknown;
	[key: string]: unknown;
};

export type MatchUpdateInput = Record<string, unknown>;

export type AttachReplayResult = {
	id: string;
	attached: boolean;
	keptExisting: boolean;
	replaySize: number;
};

export type MatchAggregation = {
	id: string;
	collectionId: string;
	collectionName: string;
	user?: string;
	maps: string[];
	players: AggregationPlayer[];
	users: string[];
};

type LobbySessionRef = Pick<MatchRecord, 'id' | 'sessionId' | 'needsResult' | 'hasReplay'>;

const DEFAULT_EXPAND = 'user';

const attachReplaySchema = z.object({
	id: z.string(),
	attached: z.boolean(),
	keptExisting: z.boolean(),
	replaySize: z.number()
});

const historyListSchema: z.ZodType<ListResult<MatchRecord>> = z
	.object({
		page: z.number(),
		perPage: z.number(),
		totalItems: z.number(),
		totalPages: z.number(),
		items: z.array(z.any())
	})
	.passthrough() as z.ZodType<ListResult<MatchRecord>>;

const aggregationPlayersSchema = z.object({
	items: z
		.array(
			z.object({
				profile_id: z.number(),
				alias: z.string()
			})
		)
		.optional()
});

const aggregationMapsSchema = z.object({
	items: z
		.array(
			z.object({
				map: z.string(),
				name: z.string()
			})
		)
		.optional()
});

const matchFiltersSchema = z.object({
	maps: z.array(z.string()).optional(),
	players: z
		.array(
			z.object({
				profile_id: z.number(),
				alias: z.string()
			})
		)
		.optional()
});

function isPreferredLobby(
	candidate: Pick<MatchRecord, 'needsResult' | 'hasReplay'>,
	current: Pick<MatchRecord, 'needsResult' | 'hasReplay'>
): boolean {
	const candidateDone = !candidate.needsResult;
	const currentDone = !current.needsResult;
	if (candidateDone !== currentDone) {
		return candidateDone;
	}

	const candidateReplay = !!candidate.hasReplay;
	const currentReplay = !!current.hasReplay;
	if (candidateReplay !== currentReplay) {
		return candidateReplay;
	}

	return false;
}

export class MatchesApi {
	constructor(private deps: ApiDeps) {}

	getPaginated(
		page = 1,
		perPage = 50,
		options: {
			filter?: string;
			fields?: string[];
			sort?: string;
			expand?: string | false;
		} = {}
	): ResultAsync<ListResult<MatchRecord>, ApiError> {
		const { filter = '', fields = [], sort = '-createdAt', expand = DEFAULT_EXPAND } = options;
		const requestOptions: Record<string, unknown> = {
			filter,
			sort,
			fetch: this.deps.fetch
		};
		if (fields.length > 0) {
			requestOptions.fields = fields.join(',');
		}

		if (expand !== false) {
			requestOptions.expand = expand;
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getList<MatchRecord>(page, perPage, requestOptions),
			'Failed to load matches.'
		);
	}

	getHistoryList(
		page = 1,
		perPage = 50,
		query: HistoryListQuery,
		options?: { signal?: AbortSignal }
	): ResultAsync<ListResult<MatchRecord>, ApiError> {
		const params = new URLSearchParams({
			scope: query.scope,
			page: String(page),
			perPage: String(perPage),
			ranked: query.ranked ? 'true' : 'false'
		});

		if (query.scope === 'user' && query.userId) {
			params.set('userId', query.userId);
		}

		if (query.scope === 'user' && query.profileId != null && query.profileId > 0) {
			params.set('profileId', String(query.profileId));
		}

		const hasAst = query.filter != null;
		if (hasAst) {
			params.set('filter', JSON.stringify(query.filter));
			params.set('ranked', 'false');
		}

		if (!hasAst && query.pro) {
			params.set('pro', 'true');
		}

		if (!hasAst && query.playerIds && query.playerIds.length > 0) {
			params.set('playerIds', query.playerIds.join(','));
		}

		if (!hasAst && query.maps && query.maps.length > 0) {
			params.set('maps', query.maps.join(','));
		}

		if (!hasAst && query.races && query.races.length > 0) {
			params.set('races', query.races.join(','));
		}

		if (!hasAst && query.matchtypes && query.matchtypes.length > 0) {
			params.set('matchtypes', query.matchtypes.join(','));
			if (query.exactMatchtypes) {
				params.set('exactMatchtypes', 'true');
			}
		}

		if (!hasAst && query.slots && query.slots.length > 0) {
			params.set('slots', query.slots.join(','));
		}

		if (query.includeSkirmish) {
			params.set('includeSkirmish', 'true');
		}

		if (!hasAst && query.eloOp && query.elo != null && Number.isFinite(query.elo)) {
			params.set('eloOp', query.eloOp);
			params.set('elo', String(query.elo));
		}

		if (!hasAst && query.durationOp && query.duration != null && Number.isFinite(query.duration)) {
			params.set('durationOp', query.durationOp);
			params.set('duration', String(query.duration));
		}

		if (query.sort && query.sort !== 'createdAt') {
			params.set('sort', query.sort);
			params.set('sortDir', query.sortDir === 'asc' ? 'asc' : 'desc');
		} else if (query.sortDir === 'asc' && (!query.sort || query.sort === 'createdAt')) {
			params.set('sort', 'createdAt');
			params.set('sortDir', 'asc');
		}

		return fromPbPromise(
			this.deps.pocketbase.send<ListResult<MatchRecord>>(
				`/api/match-history?${params.toString()}`,
				{
					method: 'GET',
					fetch: this.deps.fetch,
					signal: options?.signal
				}
			),
			'Failed to load match history.'
		).andThen((response) => {
			const parsed = historyListSchema.safeParse(response);
			if (!parsed.success) {
				return ok(response);
			}

			return ok(parsed.data);
		});
	}

	searchHistoryPlayers(
		scope: 'user' | 'community',
		q = '',
		userId?: string,
		limit = 20
	): ResultAsync<AggregationPlayer[], ApiError> {
		const params = new URLSearchParams({
			scope,
			q,
			limit: String(limit)
		});
		if (scope === 'user' && userId) {
			params.set('userId', userId);
		}

		return fromPbPromise(
			this.deps.pocketbase.send(`/api/history-players?${params.toString()}`, {
				method: 'GET',
				fetch: this.deps.fetch
			}),
			'Failed to search players.'
		).map((data) => {
			const parsed = aggregationPlayersSchema.safeParse(data);
			return parsed.success ? (parsed.data.items ?? []) : [];
		});
	}

	searchHistoryMaps(
		scope: 'user' | 'community',
		q = '',
		userId?: string,
		limit = 100
	): ResultAsync<{ map: string; name: string }[], ApiError> {
		const params = new URLSearchParams({
			scope,
			q,
			limit: String(limit)
		});
		if (scope === 'user' && userId) {
			params.set('userId', userId);
		}

		return fromPbPromise(
			this.deps.pocketbase.send(`/api/history-maps?${params.toString()}`, {
				method: 'GET',
				fetch: this.deps.fetch
			}),
			'Failed to search maps.'
		).map((data) => {
			const parsed = aggregationMapsSchema.safeParse(data);
			return parsed.success ? (parsed.data.items ?? []) : [];
		});
	}

	getList(options: RecordFullListOptions): ResultAsync<MatchRecord[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getFullList<MatchRecord>(
				pbOptions(this.deps, {
					...options,
					expand: DEFAULT_EXPAND
				})
			),
			'Failed to load matches.'
		);
	}

	getById(id: string): ResultAsync<MatchRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getOne<MatchRecord>(
				id,
				pbOptions(this.deps, { expand: DEFAULT_EXPAND })
			),
			'Failed to load match.'
		);
	}

	getBySessionId(sessionId: number): ResultAsync<MatchRecord | null, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getList<MatchRecord>(1, 1, pbOptions(this.deps, {
				filter: `sessionId=${sessionId}`,
				expand: DEFAULT_EXPAND
			})),
			'Failed to load match.'
		).map((records) => (records.items.length > 0 ? records.items[0] : null));
	}

	getIdsBySessionIds(sessionIds: number[]): ResultAsync<Map<number, string>, ApiError> {
		const unique = [...new Set(sessionIds.filter((id) => Number.isInteger(id) && id > 0))];
		if (unique.length === 0) {
			return okAsync(new Map());
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getList<LobbySessionRef>(
				1,
				Math.min(500, Math.max(unique.length * 5, unique.length)),
				pbOptions(this.deps, {
					filter: unique.map((id) => `sessionId=${id}`).join(' || '),
					fields: 'id,sessionId,needsResult,hasReplay',
					sort: '-createdAt'
				})
			),
			'Failed to load matches.'
		).map((records) => {
			const bySession = new Map<number, LobbySessionRef>();
			for (const record of records.items) {
				const sessionId = Number(record.sessionId);
				if (!Number.isFinite(sessionId) || sessionId <= 0) {
					continue;
				}

				const current = bySession.get(sessionId);
				if (!current || isPreferredLobby(record, current)) {
					bySession.set(sessionId, record);
				}
			}

			return new Map([...bySession].map(([sessionId, record]) => [sessionId, record.id]));
		});
	}

	getByIds(ids: string[]): ResultAsync<MatchRecord[], ApiError> {
		const unique = [...new Set(ids.filter(Boolean))];
		if (unique.length === 0) {
			return okAsync([]);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').getList<MatchRecord>(1, unique.length, pbOptions(this.deps, {
				filter: unique.map((id) => `id="${id}"`).join(' || '),
				expand: DEFAULT_EXPAND
			})),
			'Failed to load matches.'
		).map((records) => {
			const byId = new Map(records.items.map((record) => [record.id, record] as const));
			return unique.flatMap((id) => {
				const match = byId.get(id);
				return match ? [match] : [];
			});
		});
	}

	create(data: MatchCreateInput): ResultAsync<MatchRecord, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').create(
				{
					user: auth.value,
					...data
				},
				pbOptions(this.deps, { expand: DEFAULT_EXPAND })
			),
			'Failed to create match.'
		);
	}

	update(id: string, data: MatchUpdateInput): ResultAsync<MatchRecord, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobbies')
				.update(id, data, pbOptions(this.deps, { expand: DEFAULT_EXPAND })),
			'Failed to update match.'
		);
	}

	/**
	 * Attach a replay file to a durable lobby. Any match participant may call this;
	 * the server keeps the largest file by byte size.
	 */
	attachReplay(id: string, file: File): ResultAsync<AttachReplayResult, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return ResultAsync.fromPromise(file.arrayBuffer(), () =>
			apiError(400, 'Invalid replay upload.')
		).andThen((buffer) => {
			const bytes = new Uint8Array(buffer);
			if (bytes.byteLength < 64) {
				return errAsync(apiError(400, 'Invalid replay upload.'));
			}

			const formData = new FormData();
			formData.append(
				'file',
				new File([bytes], file.name || 'replay.rec', { type: 'application/octet-stream' })
			);

			return fetchJson(
				this.deps.fetch,
				`${normalizeBaseUrl(this.deps.baseUrl)}/api/lobbies/${encodeURIComponent(id)}/attach-replay`,
				{
					fallback: 'Failed to attach replay.',
					schema: attachReplaySchema,
					timeoutMs: 120_000,
					init: {
						method: 'POST',
						headers: resolveAuthHeaders(this.deps),
						body: formData
					},
					onStatus: (status) => {
						if (status === 401) {
							return apiError(401, 'Log in to do that.');
						}

						if (status === 403) {
							return apiError(403, 'Only match participants can attach a replay.');
						}

						if (status === 404) {
							return apiError(404, 'Match not found.');
						}

						if (status === 400) {
							return apiError(400, 'Invalid replay upload.');
						}

						return undefined;
					}
				}
			);
		});
	}

	delete(id: string): ResultAsync<boolean, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('lobbies').delete(id, pbOptions(this.deps)),
			'Failed to delete match.'
		);
	}

	findBySessionId(sessionId: number): ResultAsync<MatchRecord | null, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobbies')
				.getFirstListItem<MatchRecord>(`sessionId=${sessionId}`, pbOptions(this.deps, {
					expand: DEFAULT_EXPAND
				})),
			'Failed to load match.'
		).orElse(() => ok(null));
	}

	exists(sessionId: number): ResultAsync<boolean, ApiError> {
		return this.findBySessionId(sessionId).map((record) => record != null);
	}

	ensureStarted(data: {
		sessionId: number;
		isRanked: boolean;
		title: string;
		map: string;
		needsResult: boolean;
		players: unknown[];
	}): ResultAsync<MatchRecord, ApiError> {
		return this.findBySessionId(data.sessionId).andThen((existing) => {
			if (existing) {
				return ok(existing);
			}

			return this.create({
				isRanked: data.isRanked,
				title: data.title,
				map: data.map || 'Unknown',
				sessionId: data.sessionId,
				needsResult: data.needsResult,
				players: data.players
			}).orElse((error) =>
				this.findBySessionId(data.sessionId).andThen((raced) => {
					if (raced) {
						return ok(raced);
					}

					return errAsync(error);
				})
			);
		});
	}

	getMatchAggregation(
		type: 'user' | 'community',
		userId?: string
	): ResultAsync<MatchAggregation, ApiError> {
		const params = new URLSearchParams();
		if (type === 'user' && userId) {
			params.set('userId', userId);
		}

		const query = params.toString();
		const path = `/api/match-filters/${type}${query ? `?${query}` : ''}`;

		return fromPbPromise(
			this.deps.pocketbase.send(path, {
				method: 'GET',
				fetch: this.deps.fetch
			}),
			'Failed to load match filters.'
		)
			.map((data) => {
				const parsed = matchFiltersSchema.safeParse(data);
				const maps = parsed.success ? (parsed.data.maps ?? []) : [];
				const players = parsed.success ? (parsed.data.players ?? []) : [];
				if (type === 'user') {
					return {
						id: userId ?? '',
						collectionId: '',
						collectionName: 'lobby_aggregation',
						user: userId ?? '',
						maps,
						players,
						users: []
					};
				}

				return {
					id: '1',
					collectionId: '',
					collectionName: 'lobby_aggregation_community',
					maps,
					players,
					users: []
				};
			})
			.orElse(() =>
				ok({
					id: '',
					collectionId: '',
					collectionName:
						type === 'user' ? 'lobby_aggregation' : 'lobby_aggregation_community',
					user: type === 'user' ? (userId ?? '') : undefined,
					maps: [],
					players: [],
					users: []
				})
			);
	}
}
