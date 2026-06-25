import {
	type LobbiesResponse,
	type Create,
	type Update,
	type LobbiesRecord,
	type UsersResponse,
	type LobbyAggregationResponse,
	type LobbyAggregationCommunityResponse,
	Collections
} from '$core/pocketbase/types';
import type { ListResult, RecordFullListOptions, UnsubscribeFunc } from 'pocketbase';
import type { LobbyPlayer, Match as LobbyMatch } from '@fknoobs/app';
import type { Expand } from '@fknoobs/app';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { account } from '$core/account';

export type Match = LobbiesResponse<
	LobbyPlayer[],
	LobbyMatch | null,
	{
		user: UsersResponse<Record<string, any>, string[]>;
	}
> & { players: LobbyPlayer[] };

export type MatchExpanded = Expand<
	Match & { alliesOutcome?: 'win' | 'loss'; axisOutcome?: 'win' | 'loss' }
>;

export type AggregationPlayer = { profile_id: number; alias: string };

const DEFAULT_EXPAND = 'user';

const HISTORY_LIST_FIELDS: (keyof LobbiesRecord)[] = [
	'id',
	'createdAt',
	'isRanked',
	'map',
	'title',
	'players',
	'result',
	'sessionId',
	'needsResult'
];

/**
 * Match (lobby) repository.
 */
export class Matches {
	/**
	 * Retrieves a paginated list of matches.
	 */
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-createdAt',
			expand = DEFAULT_EXPAND
		}: {
			filter?: string;
			fields?: (keyof LobbiesRecord)[];
			sort?: string;
			expand?: string | false;
		} = {}
	): Promise<ListResult<MatchExpanded>> {
		const requestOptions: Parameters<
			ReturnType<typeof pocketbase.collection<'lobbies'>>['getList']
		>[2] = {
			filter,
			sort,
			fetch
		};

		if (fields.length > 0) {
			requestOptions.fields = fields.join(',');
		}

		if (expand !== false) {
			requestOptions.expand = expand;
		}

		const response = await pocketbase
			.collection('lobbies')
			.getList<Match>(page, perPage, requestOptions);

		return {
			...response,
			items: response.items.map(exp) as MatchExpanded[]
		};
	}

	/** Lightweight list used by the history page. */
	getHistoryList(page = 1, perPage = 50, filter = '') {
		return this.getPaginated(page, perPage, {
			filter,
			sort: '-createdAt',
			fields: HISTORY_LIST_FIELDS,
			expand: false
		});
	}

	/** Retrieves a full list of matches. */
	async getList(options: RecordFullListOptions): Promise<MatchExpanded[]> {
		const response = await pocketbase.collection('lobbies').getFullList<Match>({
			...options,
			expand: DEFAULT_EXPAND,
			fetch
		});

		return response.map(exp) as MatchExpanded[];
	}

	async getAll(): Promise<MatchExpanded[]> {
		const response = await pocketbase.collection('lobbies').getFullList<Match>(1000, {
			expand: DEFAULT_EXPAND,
			fetch
		});

		return response.map(exp) as MatchExpanded[];
	}

	/** Retrieves a single match by its record ID. */
	async getById(id: string): Promise<MatchExpanded> {
		const record = await pocketbase.collection('lobbies').getOne<Match>(id, {
			fetch,
			expand: DEFAULT_EXPAND
		});

		return exp(record) as MatchExpanded;
	}

	/** Retrieves a single match by its game session ID. */
	async getBySessionId(sessionId: number): Promise<MatchExpanded | null> {
		const records = await pocketbase.collection('lobbies').getList<Match>(1, 1, {
			filter: `sessionId=${sessionId}`,
			expand: DEFAULT_EXPAND,
			fetch
		});

		return records.items.length > 0 ? (exp(records.items[0]) as MatchExpanded) : null;
	}

	/** Creates a match owned by the authenticated user. */
	async create(data: Omit<Create<'lobbies'>, 'user'>): Promise<MatchExpanded> {
		return await pocketbase.collection('lobbies').create(
			{
				user: pocketbase.authStore.record?.id ?? account.userId,
				...data
			},
			{
				expand: DEFAULT_EXPAND,
				fetch
			}
		);
	}

	async update(id: string, data: Update<'lobbies'>): Promise<MatchExpanded> {
		return await pocketbase.collection('lobbies').update(id, data, {
			expand: DEFAULT_EXPAND,
			fetch
		});
	}

	async delete(id: string): Promise<boolean> {
		return await pocketbase.collection('lobbies').delete(id, { fetch });
	}

	/** Whether a match with the given session ID already exists. */
	async exists(sessionId: number): Promise<boolean> {
		return pocketbase
			.collection('lobbies')
			.getFirstListItem(`sessionId=${sessionId}`, { fetch })
			.then(() => true)
			.catch(() => false);
	}

	/** Subscribes to realtime updates of a single match record. */
	subscribe(
		id: string,
		callback: (match: MatchExpanded) => void
	): Promise<UnsubscribeFunc> {
		return pocketbase.collection('lobbies').subscribe(
			id,
			(event) => {
				if (event.action === 'update') {
					this.getById(event.record.id)
						.then(callback)
						.catch((error) => {
							console.error('[MATCHES]: failed to fetch updated match:', error);
						});
				}
			},
			{ fetch }
		);
	}

	/** Retrieves match aggregation data (filters for the history page). */
	async getMatchAggregation(
		type: 'user' | 'community',
		userId?: string
	): Promise<
		| LobbyAggregationResponse<string, string[], AggregationPlayer[]>
		| LobbyAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
	> {
		try {
			if (type === 'user') {
				return await pocketbase
					.collection<
						LobbyAggregationResponse<string, string[], AggregationPlayer[]>
					>('lobby_aggregation')
					.getFirstListItem(`user="${userId}"`, { fetch });
			}

			return await pocketbase
				.collection<
					LobbyAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
				>('lobby_aggregation_community')
				.getFirstListItem('', { fetch });
		} catch {
			// No aggregation yet (new user / empty community): empty fallback.
			if (type === 'user') {
				return {
					id: '',
					collectionId: '',
					collectionName: Collections.LobbyAggregation,
					maps: [],
					players: [],
					users: []
				} as unknown as LobbyAggregationResponse<string, string[], AggregationPlayer[]>;
			}

			return {
				id: '',
				collectionId: '',
				collectionName: Collections.LobbyAggregationCommunity,
				maps: [],
				players: [],
				users: []
			} as unknown as LobbyAggregationCommunityResponse<string[], AggregationPlayer[], string[]>;
		}
	}
}
