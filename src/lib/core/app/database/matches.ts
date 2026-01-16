import type {
	MatchesResponse,
	Create,
	Update,
	MatchesRecord,
	UsersResponse,
	MatchAggregationResponse,
	MatchAggregationCommunityResponse
} from '$core/pocketbase/types';
import type { ListResult, RecordFullListOptions } from 'pocketbase';
import type { LobbyPlayer, Match as LobbyMatch } from '@fknoobs/app';
import type { Expand } from '@fknoobs/app';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { app } from '$core/app/context';
import { lte } from 'semver';

export type Match = MatchesResponse<
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

/**
 * @todo Add caching layer
 * @todo Add logging
 * @todo Remove the user relation and just store the matches. We can retrieve the matches for the user via the steamIds in the app context.
 * Since the players are stored with their steamIds, we can filter the matches for the current user easily.
 */
export class Matches {
	/**
	 * Retrieves a paginated list of lobbies.
	 *
	 * @param options Configuration options for the request
	 */
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-createdAt'
		}: { filter?: string; fields?: (keyof MatchesRecord)[]; sort?: string } = {}
	): Promise<ListResult<MatchExpanded>> {
		const fieldsString = fields.join(',');
		const response = await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getList<Match>(page, perPage, {
				filter,
				fields: fieldsString,
				sort,
				expand: DEFAULT_EXPAND,
				fetch
			});

		return {
			...response,
			items: response.items.map(exp) as MatchExpanded[]
		};
	}

	/**
	 * Retrieves a full list of lobbies based on the provided options.
	 *
	 * @param options Configuration options for the request
	 */
	async getList(options: RecordFullListOptions): Promise<MatchExpanded[]> {
		const response = await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getFullList<Match>({
				...options,
				expand: DEFAULT_EXPAND,
				fetch
			});

		return response.map(exp) as MatchExpanded[];
	}

	async getAll(): Promise<MatchExpanded[]> {
		const response = await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getFullList<Match>(1000, {
				expand: DEFAULT_EXPAND,
				fetch
			});

		return response.map(exp) as MatchExpanded[];
	}

	/**
	 * Retrieves a single lobby by its ID.
	 *
	 * @param id The ID of the lobby
	 */
	async getById(id: string): Promise<MatchExpanded> {
		const record = await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getOne<Match>(id, {
				fetch,
				expand: DEFAULT_EXPAND
			});
		return exp(record) as MatchExpanded;
	}

	/**
	 * Retrieves a single lobby by its session ID.
	 *
	 * @param sessionId The session ID of the lobby
	 */
	async getBySessionId(sessionId: number): Promise<MatchExpanded | null> {
		const records = await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getList<Match>(1, 1, {
				filter: `sessionId=${sessionId}`,
				expand: DEFAULT_EXPAND,
				fetch
			});
		return records.items.length > 0 ? (exp(records.items[0]) as MatchExpanded) : null;
	}

	/**
	 * Creates a new lobby record.
	 *
	 * @param data The data to create the lobby with
	 */
	async create(data: Omit<Create<'matches'>, 'user'>): Promise<MatchExpanded> {
		const newData = {
			user: app.pocketbase.authStore.record!.id,
			...data
		};
		return await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.create(newData, {
				expand: DEFAULT_EXPAND,
				fetch
			});
	}

	/**
	 * Updates an existing lobby record.
	 *
	 * @param id The ID of the lobby to update
	 * @param data The data to update the lobby with
	 */
	async update(id: string, data: Update<'matches'>): Promise<MatchExpanded> {
		return await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.update(id, data, {
				expand: DEFAULT_EXPAND,
				fetch
			});
	}

	/**
	 * Deletes a lobby record.
	 *
	 * @param id The ID of the lobby to delete
	 */
	async delete(id: string): Promise<boolean> {
		return await pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.delete(id, { fetch });
	}

	/**
	 * Checks if a lobby with the given session ID and user exists.
	 *
	 * @param sessionId The session ID to check
	 * @returns {Promise<boolean>} True if the lobby exists, false otherwise
	 */
	async exists(sessionId: number): Promise<boolean> {
		return pocketbase
			.collection(lte('0.40.1', app.version) ? 'lobbies' : 'matches')
			.getFirstListItem(`sessionId=${sessionId}`, { fetch })
			.then(() => true)
			.catch(() => false);
	}

	/**
	 * Retrieves match aggregation data.
	 *
	 * @param type The type of aggregation ('user' or 'community')
	 * @param userId The user ID for 'user' type aggregation
	 */
	async getMatchAggregation(type: 'user' | 'community', userId?: string) {
		if (type === 'user') {
			return pocketbase
				.collection<
					MatchAggregationResponse<string[], AggregationPlayer[], string>
				>(lte('0.40.1', app.version) ? 'lobby_aggregation' : 'match_aggregation')
				.getFirstListItem('user="' + userId + '"', { fetch });
		}

		return pocketbase
			.collection<
				MatchAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
			>(lte('0.40.1', app.version) ? 'lobby_aggregation_community' : 'match_aggregation_community')
			.getFirstListItem('', { fetch });
	}
}
