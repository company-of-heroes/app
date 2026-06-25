import type {
	ReplaysResponse,
	Create,
	Update,
	ReplaysRecord,
	UsersResponse
} from '$core/pocketbase/types';
import type { Expand } from '@fknoobs/app';
import type { Message, Player } from '@fknoobs/replay-parser';
import type { ListResult } from 'pocketbase';
import { exp, getFile, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { account } from '$core/account';

export type ReplaysExpanded = Expand<
	ReplaysResponse<Message[], Player[], { createdBy: UsersResponse }>
>;

/**
 * Replay repository.
 */
export class Replays {
	/** Retrieves a paginated list of replays. */
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-gameDate'
		}: { filter?: string; fields?: (keyof ReplaysRecord)[]; sort?: string } = {}
	): Promise<ListResult<ReplaysExpanded>> {
		const response = await pocketbase
			.collection('replays')
			.getList<ReplaysResponse<Message[], Player[]>>(page, perPage, {
				filter,
				fields: fields.join(','),
				sort,
				expand: 'createdBy',
				fetch
			});

		return {
			...response,
			items: response.items.map(exp) as unknown as ReplaysExpanded[]
		};
	}

	async getAll(): Promise<ReplaysExpanded[]> {
		const response = await pocketbase
			.collection('replays')
			.getFullList<ReplaysResponse<Message[], Player[]>>(1000, {
				expand: 'createdBy',
				fetch
			});

		return response.map(exp) as unknown as ReplaysExpanded[];
	}

	/**
	 * Retrieves the raw replay file by record ID. Falls back to the match
	 * (lobby) record's replay file for links created from match pages.
	 */
	async getById(id: string): Promise<Uint8Array> {
		try {
			const record = await pocketbase.collection('replays').getOne(id, { fetch });
			return await getFile(record, record.file);
		} catch {
			const record = await pocketbase.collection('lobbies').getOne(id, { fetch });
			return await getFile(record, record.replay);
		}
	}

	/** Retrieves a single replay by its filename. */
	async getByFilename(filename: string) {
		const records = await pocketbase.collection('replays').getFullList<ReplaysRecord>(20000, {
			filter: `filename="${filename}"`,
			requestKey: null,
			fetch
		});

		return records.length > 0 ? records[0] : null;
	}

	/** All replay filenames uploaded by the current user. */
	async getExistingFilenamesByUser(): Promise<string[]> {
		const records = await pocketbase.collection('replays').getFullList({
			filter: `createdBy = "${account.userId}"`,
			fields: 'filename',
			requestKey: null,
			fetch
		});

		return records.map((r) => r.filename);
	}

	async create(data: Omit<Create<'replays'>, 'createdBy'>) {
		return await pocketbase.collection('replays').create(
			{
				createdBy: pocketbase.authStore.record?.id ?? account.userId,
				...data
			},
			{ fetch, requestKey: null }
		);
	}

	async update(id: string, data: Update<'replays'>) {
		return await pocketbase.collection('replays').update(id, data, { fetch });
	}

	async delete(id: string) {
		return await pocketbase.collection('replays').delete(id, { fetch });
	}
}
