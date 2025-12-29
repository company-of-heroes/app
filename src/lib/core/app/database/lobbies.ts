import type {
	LobbiesResponse,
	Create,
	Update,
	LobbiesRecord,
	UsersResponse
} from '$core/pocketbase/types';
import type { ListResult, RecordFullListOptions } from 'pocketbase';
import type { LobbyPlayer, Match as LobbyMatch } from '@fknoobs/app';
import type { Expand } from '@fknoobs/app';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { app } from '$core/context';

export type Match = LobbiesResponse<
	LobbyPlayer[],
	LobbyMatch | null,
	{
		user: UsersResponse<string[]>;
	}
> & { players: LobbyPlayer[] };
export type MatchExpanded = Expand<Match>;

const DEFAULT_EXPAND = 'user';

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
		}: { filter?: string; fields?: (keyof LobbiesRecord)[]; sort?: string } = {}
	): Promise<ListResult<MatchExpanded>> {
		const fieldsString = fields.join(',');
		const response = await pocketbase.collection('lobbies').getList<Match>(page, perPage, {
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

	/**
	 * Retrieves a single lobby by its ID.
	 *
	 * @param id The ID of the lobby
	 */
	async getById(id: string): Promise<MatchExpanded> {
		const record = await pocketbase.collection('lobbies').getOne<Match>(id, {
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
		const records = await pocketbase.collection('lobbies').getList<Match>(1, 1, {
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
	async create(data: Omit<Create<'lobbies'>, 'user'>): Promise<MatchExpanded> {
		const newData = {
			user: app.pocketbase.authStore.record!.id,
			...data
		};
		return await pocketbase.collection('lobbies').create(newData, {
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
	async update(id: string, data: Update<'lobbies'>): Promise<MatchExpanded> {
		return await pocketbase.collection('lobbies').update(id, data, {
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
		return await pocketbase.collection('lobbies').delete(id, { fetch });
	}

	/**
	 * Checks if a lobby with the given session ID exists.
	 *
	 * @param sessionId The session ID to check
	 * @returns {Promise<boolean>} True if the lobby exists, false otherwise
	 */
	async exists(sessionId: number): Promise<boolean> {
		return pocketbase
			.collection('lobbies')
			.getFirstListItem(`sessionId=${sessionId}`, { fetch })
			.then(() => true)
			.catch(() => false);
	}
}
