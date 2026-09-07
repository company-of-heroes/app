import type {
	ReplaysResponse,
	Create,
	Update,
	ReplaysRecord,
	UsersResponse
} from '$core/pocketbase/types';
import type { Expand } from '@fknoobs/app';
import type { Message, Player } from '@fknoobs/replay-parser';
import { setReplayName } from '@fknoobs/replay-parser';
import type { ListResult } from 'pocketbase';
import { exp, getFile, pocketbase } from '$core/pocketbase';
import { fetch } from '$core/http/fetch';
import { account } from '$core/account';
import { app } from '$core/app/context';
import { api, unwrapApi } from '$core/api';
import { join } from '@tauri-apps/api/path';
import { exists, writeFile, remove } from '@tauri-apps/plugin-fs';
import { t } from '$lib/i18n';

export type ReplaysExpanded = Expand<
	ReplaysResponse<Message[], Player[], { createdBy: UsersResponse }>
>;

export type ReplayDetail = {
	bytes: Uint8Array;
	/** Set when the id belongs to the `replays` collection; null for lobby fallbacks. */
	record: ReplaysRecord | null;
};

/**
 * Replay repository.
 */
export class Replays {
	async getPaginated(
		page = 1,
		perPage = 50,
		{
			filter = '',
			fields = [],
			sort = '-gameDate'
		}: { filter?: string; fields?: (keyof ReplaysRecord)[]; sort?: string } = {}
	): Promise<ListResult<ReplaysExpanded>> {
		const response = await unwrapApi(
			api.replays.getPaginated(page, perPage, {
				filter,
				fields: fields.map(String),
				sort
			})
		);

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

	async getDetail(id: string): Promise<ReplayDetail> {
		try {
			const record = await unwrapApi(api.replays.getById(id));
			const bytes = await getFile(record, String(record.file ?? ''));
			return { bytes, record: record as unknown as ReplaysRecord };
		} catch {
			const lobby = await pocketbase.collection('lobbies').getOne(id, { fetch });
			const bytes = await getFile(lobby, lobby.replay);
			return { bytes, record: null };
		}
	}

	async getById(id: string): Promise<Uint8Array> {
		const { bytes } = await this.getDetail(id);
		return bytes;
	}

	async rename(
		id: string,
		replayName: string
	): Promise<{ bytes: Uint8Array; title: string; file: string; filename: string }> {
		const record = await unwrapApi(api.replays.getById(id));
		const current = await getFile(record, String(record.file ?? ''));
		const title = replayName.trim() || '-';
		const bytes = setReplayName(current, title === '-' ? '' : title);
		const localName = String(record.filename || record.file || 'replay.rec');
		const file = new File([bytes], localName);

		const updated = await this.update(id, { title, file });

		try {
			const localPath = await join(await app.paths.cohPlaybackDir(), localName);
			await writeFile(localPath, bytes);
		} catch (error) {
			console.warn('[REPLAYS]: failed to write renamed local replay', localName, error);
		}

		return {
			bytes,
			title,
			file: updated.file,
			filename: updated.filename || localName
		};
	}

	async localPath(filename: string): Promise<string> {
		return join(await app.paths.cohPlaybackDir(), filename);
	}

	async localExists(filename: string): Promise<boolean> {
		if (!filename) {
			return false;
		}

		try {
			return await exists(await this.localPath(filename));
		} catch {
			return false;
		}
	}

	async deleteLocal(filename: string): Promise<boolean> {
		if (!filename) {
			return false;
		}

		const path = await this.localPath(filename);
		if (!(await exists(path))) {
			return false;
		}

		await remove(path);
		return true;
	}

	async download(id: string) {
		const record = await unwrapApi(api.replays.getById(id));
		const localName = String(record.filename || record.file || '');
		if (!localName || !record.file) {
			throw new Error(t('Replay file is missing'));
		}

		const bytes = await getFile(record, String(record.file));
		await writeFile(await this.localPath(localName), bytes);
		return { filename: localName, file: String(record.file) };
	}

	async getByFilename(filename: string) {
		const records = await pocketbase.collection('replays').getFullList<ReplaysRecord>(20000, {
			filter: `filename="${filename}"`,
			requestKey: null,
			fetch
		});

		return records.length > 0 ? records[0] : null;
	}

	async getExistingFilenamesByUser(): Promise<string[]> {
		return unwrapApi(api.replays.getExistingFilenamesByUser());
	}

	async publish(id: string, description?: string) {
		return unwrapApi(api.replays.publish(id, description));
	}

	async publishFromMatch(
		lobbyId: string,
		input?: {
			title?: string;
			description?: string;
			durationInSeconds?: number;
			players?: unknown;
		}
	) {
		return unwrapApi(api.replays.publishFromMatch(lobbyId, input));
	}

	async unpublish(id: string) {
		return unwrapApi(api.replays.unpublish(id));
	}

	async create(data: Omit<Create<'replays'>, 'createdBy'>) {
		return await pocketbase.collection('replays').create(
			{
				createdBy: pocketbase.authStore.record?.id ?? account.userId,
				visibility: 'private',
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
