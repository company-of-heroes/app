import type { LobbiesResponse, Create, Update, LobbiesRecord } from '$core/pocketbase/types';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import type { ListResult, RecordFullListOptions } from 'pocketbase';
import type { LobbyPlayer, Match } from '@fknoobs/app';
import { app } from '..';

export type LobbiesExpanded = Expand<LobbiesResponse<LobbyPlayer[], Match | null>>;

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
	): Promise<ListResult<LobbiesExpanded>> {
		const fieldsString = fields.join(',');
		const response = await pocketbase
			.collection('lobbies')
			.getList<LobbiesResponse<LobbyPlayer[], Match | null>>(page, perPage, {
				filter,
				fields: fieldsString,
				sort,
				fetch
			});

		return {
			...response,
			items: response.items.map(exp) as LobbiesExpanded[]
		};
	}

	/**
	 * Retrieves a full list of lobbies based on the provided options.
	 *
	 * @param options Configuration options for the request
	 */
	async getList(options: RecordFullListOptions) {
		const response = await pocketbase
			.collection('lobbies')
			.getFullList<LobbiesResponse<LobbyPlayer[], Match | null>>({ ...options, fetch });

		return response.map(exp) as LobbiesExpanded[];
	}

	async getAll(): Promise<LobbiesExpanded[]> {
		const response = await pocketbase
			.collection('lobbies')
			.getFullList<LobbiesResponse<LobbyPlayer[], any>>(1000, {
				fetch
			});

		return response.map(exp) as LobbiesExpanded[];
	}

	/**
	 * Retrieves a single lobby by its ID.
	 *
	 * @param id The ID of the lobby
	 */
	async getById(id: string) {
		const record = await pocketbase
			.collection('lobbies')
			.getOne<LobbiesResponse<LobbyPlayer[], any>>(id, { fetch });
		return exp(record) as LobbiesExpanded;
	}

	/**
	 * Retrieves a single lobby by its session ID.
	 *
	 * @param sessionId The session ID of the lobby
	 */
	async getBySessionId(sessionId: number) {
		const records = await pocketbase
			.collection('lobbies')
			.getList<LobbiesResponse<LobbyPlayer[], any>>(1, 1, {
				filter: `sessionId=${sessionId}`,
				fetch
			});
		return records.items.length > 0 ? (exp(records.items[0]) as LobbiesExpanded) : null;
	}

	/**
	 * Creates a new lobby record.
	 *
	 * @param data The data to create the lobby with
	 */
	async create(data: Omit<Create<'lobbies'>, 'user'>) {
		const newData = {
			user: app.pocketbase.authStore.record!.id,
			...data
		};
		return await pocketbase.collection('lobbies').create(newData, { fetch });
	}

	/**
	 * Updates an existing lobby record.
	 *
	 * @param id The ID of the lobby to update
	 * @param data The data to update the lobby with
	 */
	async update(id: string, data: Update<'lobbies'>) {
		return await pocketbase.collection('lobbies').update(id, data, { fetch });
	}

	/**
	 * Deletes a lobby record.
	 *
	 * @param id The ID of the lobby to delete
	 */
	async delete(id: string) {
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
