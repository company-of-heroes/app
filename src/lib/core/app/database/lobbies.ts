import type {
	LobbiesResponse,
	Create,
	Update,
	LobbiesRecord,
	UsersResponse
} from '$core/pocketbase/types';
import type { Expand } from '@fknoobs/app';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import type { ListResult, RecordFullListOptions } from 'pocketbase';
import type { LobbyPlayer, Match } from '@fknoobs/app';
import { app } from '..';

export type Lobby = LobbiesResponse<
	LobbyPlayer[],
	Match | null,
	{
		user: UsersResponse<string[]>;
	}
>;
export type LobbyExpanded = Expand<Lobby>;

const DEFAULT_EXPAND = 'user';

export class Lobbies {
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
	): Promise<ListResult<LobbyExpanded>> {
		const fieldsString = fields.join(',');
		const response = await pocketbase.collection('lobbies').getList<Lobby>(page, perPage, {
			filter,
			fields: fieldsString,
			sort,
			expand: DEFAULT_EXPAND,
			fetch
		});

		return {
			...response,
			items: response.items.map(exp) as LobbyExpanded[]
		};
	}

	/**
	 * Retrieves a full list of lobbies based on the provided options.
	 *
	 * @param options Configuration options for the request
	 */
	async getList(options: RecordFullListOptions): Promise<LobbyExpanded[]> {
		const response = await pocketbase.collection('lobbies').getFullList<Lobby>({
			...options,
			expand: DEFAULT_EXPAND,
			fetch
		});

		return response.map(exp) as LobbyExpanded[];
	}

	async getAll(): Promise<LobbyExpanded[]> {
		const response = await pocketbase.collection('lobbies').getFullList<Lobby>(1000, {
			expand: DEFAULT_EXPAND,
			fetch
		});

		return response.map(exp) as LobbyExpanded[];
	}

	/**
	 * Retrieves a single lobby by its ID.
	 *
	 * @param id The ID of the lobby
	 */
	async getById(id: string): Promise<LobbyExpanded> {
		const record = await pocketbase.collection('lobbies').getOne<Lobby>(id, {
			fetch,
			expand: DEFAULT_EXPAND
		});
		return exp(record) as LobbyExpanded;
	}

	/**
	 * Retrieves a single lobby by its session ID.
	 *
	 * @param sessionId The session ID of the lobby
	 */
	async getBySessionId(sessionId: number): Promise<LobbyExpanded | null> {
		const records = await pocketbase.collection('lobbies').getList<Lobby>(1, 1, {
			filter: `sessionId=${sessionId}`,
			expand: DEFAULT_EXPAND,
			fetch
		});
		return records.items.length > 0 ? (exp(records.items[0]) as LobbyExpanded) : null;
	}

	/**
	 * Creates a new lobby record.
	 *
	 * @param data The data to create the lobby with
	 */
	async create(data: Omit<Create<'lobbies'>, 'user'>): Promise<LobbyExpanded> {
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
	async update(id: string, data: Update<'lobbies'>): Promise<LobbyExpanded> {
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
