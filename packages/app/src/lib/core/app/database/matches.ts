import {
	type LobbiesResponse,
	type Create,
	type Update,
	type LobbiesRecord,
	type UsersResponse
} from '$core/pocketbase/types';
import type { ListResult, RecordFullListOptions } from 'pocketbase';
import type { LobbyPlayer, Match as LobbyMatch } from '@fknoobs/app';
import type { Expand } from '@fknoobs/app';
import { exp } from '$core/pocketbase';
import { api, unwrapApi } from '$core/api';
import type {
	AggregationPlayer,
	AttachReplayResult,
	FilterOperator,
	HistoryListQuery,
	HistorySortField,
	MatchAggregation,
	MatchCreateInput,
	MatchUpdateInput
} from '@company-of-heroes/api';

export type Match = LobbiesResponse<
	unknown,
	LobbyPlayer[],
	LobbyMatch | null,
	{
		user: UsersResponse<Record<string, any>, string[]>;
	}
> & { players: LobbyPlayer[] };

export type MatchExpanded = Expand<
	Match & { alliesOutcome?: 'win' | 'loss'; axisOutcome?: 'win' | 'loss' }
>;

export type { AggregationPlayer, FilterOperator, HistoryListQuery, HistorySortField };

/**
 * Match (lobby) repository.
 */
export class Matches {
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-createdAt',
			expand = 'user'
		}: {
			filter?: string;
			fields?: (keyof LobbiesRecord)[];
			sort?: string;
			expand?: string | false;
		} = {}
	): Promise<ListResult<MatchExpanded>> {
		const response = await unwrapApi(
			api.matches.getPaginated(page, perPage, {
				filter,
				fields: fields.map(String),
				sort,
				expand
			})
		);

		return {
			...response,
			items: response.items.map(exp) as unknown as unknown as MatchExpanded[]
		};
	}

	async getHistoryList(
		page = 1,
		perPage = 50,
		query: HistoryListQuery,
		options?: { signal?: AbortSignal }
	): Promise<ListResult<MatchExpanded>> {
		const response = await unwrapApi(api.matches.getHistoryList(page, perPage, query, options));
		return {
			...response,
			items: response.items.map(exp) as unknown as unknown as MatchExpanded[]
		};
	}

	async searchHistoryPlayers(
		scope: 'user' | 'community',
		q = '',
		userId?: string,
		limit = 20
	): Promise<AggregationPlayer[]> {
		return unwrapApi(api.matches.searchHistoryPlayers(scope, q, userId, limit));
	}

	async searchHistoryMaps(
		scope: 'user' | 'community',
		q = '',
		userId?: string,
		limit = 100
	): Promise<{ map: string; name: string }[]> {
		return unwrapApi(api.matches.searchHistoryMaps(scope, q, userId, limit));
	}

	async getList(options: RecordFullListOptions): Promise<MatchExpanded[]> {
		const response = await unwrapApi(api.matches.getList(options));
		return response.map(exp) as unknown as unknown as MatchExpanded[];
	}

	async getAll(): Promise<MatchExpanded[]> {
		const response = await unwrapApi(api.matches.getList({ batch: 1000 }));
		return response.map(exp) as unknown as unknown as MatchExpanded[];
	}

	async getById(id: string): Promise<MatchExpanded> {
		const record = await unwrapApi(api.matches.getById(id));
		return exp(record) as unknown as MatchExpanded;
	}

	async getBySessionId(sessionId: number): Promise<MatchExpanded | null> {
		const record = await unwrapApi(api.matches.getBySessionId(sessionId));
		return record ? (exp(record) as unknown as MatchExpanded) : null;
	}

	async getIdsBySessionIds(sessionIds: number[]): Promise<Map<number, string>> {
		return unwrapApi(api.matches.getIdsBySessionIds(sessionIds));
	}

	async getByIds(ids: string[]): Promise<MatchExpanded[]> {
		const records = await unwrapApi(api.matches.getByIds(ids));
		return records.map(exp) as unknown as unknown as MatchExpanded[];
	}

	async create(data: Omit<Create<'lobbies'>, 'user'>): Promise<MatchExpanded> {
		const record = await unwrapApi(api.matches.create(data as MatchCreateInput));
		return exp(record) as unknown as MatchExpanded;
	}

	async update(id: string, data: Update<'lobbies'>): Promise<MatchExpanded> {
		const record = await unwrapApi(api.matches.update(id, data as MatchUpdateInput));
		return exp(record) as unknown as MatchExpanded;
	}

	async attachReplay(id: string, file: File): Promise<AttachReplayResult> {
		return unwrapApi(api.matches.attachReplay(id, file));
	}

	async delete(id: string): Promise<boolean> {
		return unwrapApi(api.matches.delete(id));
	}

	async findBySessionId(sessionId: number): Promise<MatchExpanded | null> {
		const record = await unwrapApi(api.matches.findBySessionId(sessionId));
		return record ? (exp(record) as unknown as MatchExpanded) : null;
	}

	async exists(sessionId: number): Promise<boolean> {
		return unwrapApi(api.matches.exists(sessionId));
	}

	async ensureStarted(data: {
		sessionId: number;
		isRanked: boolean;
		title: string;
		map: string;
		needsResult: boolean;
		players: LobbyPlayer[];
	}): Promise<MatchExpanded> {
		const record = await unwrapApi(api.matches.ensureStarted(data));
		return exp(record) as unknown as MatchExpanded;
	}

	async getMatchAggregation(
		type: 'user' | 'community',
		userId?: string
	): Promise<MatchAggregation> {
		return unwrapApi(api.matches.getMatchAggregation(type, userId));
	}
}
