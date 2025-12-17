import type {
	ReplaysResponse,
	Create,
	Update,
	ReplaysRecord,
	UsersResponse
} from '$core/pocketbase/types';
import { exp, getFile, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { app } from '../app.svelte';
import type { ListResult } from 'pocketbase';
import { readFile } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import type { Message, Player } from '@fknoobs/replay-parser';

export type ReplaysExpanded = Expand<
	ReplaysResponse<Message[], Player[], { createdBy: UsersResponse }>
>;

export class Replays {
	/**
	 * Retrieves a paginated list of replays.
	 *
	 * @param options Configuration options for the request
	 */
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-gameDate'
		}: { filter?: string; fields?: (keyof ReplaysRecord)[]; sort?: string } = {}
	): Promise<ListResult<ReplaysExpanded>> {
		const fieldsString = fields.join(',');
		const response = await pocketbase
			.collection('replays')
			.getList<ReplaysResponse<Message[], Player[]>>(page, perPage, {
				filter,
				fields: fieldsString,
				sort,
				expand: 'createdBy',
				fetch
			});

		return {
			...response,
			items: response.items.map(exp) as ReplaysExpanded[]
		};
	}

	async getAll(): Promise<ReplaysExpanded[]> {
		const response = await pocketbase
			.collection('replays')
			.getFullList<ReplaysResponse<Message[], Player[]>>(1000, {
				expand: 'createdBy',
				fetch
			});

		return response.map(exp) as ReplaysExpanded[];
	}

	/**
	 * Retrieves a single replay by its ID.
	 *
	 * @param id The ID of the replay
	 */
	async getById(id: string) {
		const record = await pocketbase.collection('replays').getOne(id, { fetch });
		const configDir = await dirname(app.settings.companyOfHeroesConfigPath);
		const playbackDir = await join(configDir, 'playback');
		//const file = await readFile(await join(playbackDir, record.filename));
		const file = await getFile(record, record.file);

		return {
			...record,
			file
		};
	}

	/**
	 * Retrieves a single replay by its filename.
	 *
	 * @param filename The filename of the replay
	 */
	async getByFilename(filename: string) {
		const records = await pocketbase.collection('replays').getFullList<ReplaysRecord>(20000, {
			filter: `filename="${filename}"`,
			requestKey: null,
			fetch
		});
		return records.length > 0 ? records[0] : null;
	}

	/**
	 * Retrieves all existing replay filenames.
	 */
	async getExistingFilenames(): Promise<string[]> {
		const records = await pocketbase.collection('replays').getFullList({
			fields: 'filename',
			requestKey: null,
			fetch
		});
		return records.map((r) => r.filename);
	}

	/**
	 * Creates a new replay record.
	 *
	 * @param data The data to create the replay with
	 */
	async create(data: Omit<Create<'replays'>, 'createdBy'>) {
		const newData = {
			createdBy: app.pocketbase.authStore.record!.id,
			...data
		};
		return await pocketbase.collection('replays').create(newData, { fetch, requestKey: null });
	}

	/**
	 * Updates an existing replay record.
	 *
	 * @param id The ID of the replay to update
	 * @param data The data to update the replay with
	 */
	async update(id: string, data: Update<'replays'>) {
		return await pocketbase.collection('replays').update(id, data, { fetch });
	}

	/**
	 * Deletes a replay record.
	 *
	 * @param id The ID of the replay to delete
	 */
	async delete(id: string) {
		return await pocketbase.collection('replays').delete(id, { fetch });
	}
}
