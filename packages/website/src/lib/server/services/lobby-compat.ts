import type { RecordModel } from 'pocketbase';
import { errAsync } from 'neverthrow';
import { badRequest } from '../errors';
import type { Task } from '../result';
import { parse } from '../validate';
import { livePublishSchema, lobbyCreateSchema, lobbyUpdateSchema } from '../domain/lobby-writes';
import type { RecordOptions } from './lobbies';
import { Service } from './service';

/**
 * Older app versions write `lobbies` and `lobbies_live` straight to PocketBase.
 * The api-gateway sends those writes here; each one becomes the lobby service
 * call and the response is the PocketBase record, as the SDK expects.
 */
export const LOBBY_COMPAT_COLLECTIONS = ['lobbies', 'lobbies_live'] as const;
export type LobbyCompatCollection = (typeof LOBBY_COMPAT_COLLECTIONS)[number];

type Body = Record<string, unknown>;

export class LobbyCompatService extends Service {
	create(
		collection: LobbyCompatCollection,
		body: Body,
		userId: string,
		options: RecordOptions
	): Task<RecordModel> {
		const { lobbies, liveLobbies } = this.services;
		if (collection === 'lobbies_live') {
			if (body.user !== userId) {
				return errAsync(badRequest('Failed to create record.'));
			}

			return parse(livePublishSchema, body).asyncAndThen((input) =>
				liveLobbies.publish(userId, input, options)
			);
		}

		return parse(lobbyCreateSchema, body)
			.asyncAndThen((input) => lobbies.ensure(userId, input))
			.andThen(({ id }) => lobbies.view(id, options));
	}

	update(
		collection: LobbyCompatCollection,
		id: string,
		body: Body,
		files: Record<string, File>,
		userId: string,
		options: RecordOptions
	): Task<RecordModel> {
		const { lobbies, liveLobbies } = this.services;
		if (collection === 'lobbies_live') {
			return liveLobbies
				.ownRowById(id, userId)
				.andThen(() => parse(livePublishSchema, body))
				.andThen((input) => liveLobbies.publish(userId, input, options));
		}

		const replay = files.replay
			? { file: files.replay, seconds: Number(body.replayDurationSeconds) || 0 }
			: undefined;
		return parse(lobbyUpdateSchema, body)
			.asyncAndThen((input) => lobbies.update(id, userId, input, replay))
			.andThen(() => lobbies.view(id, options));
	}

	remove(collection: LobbyCompatCollection, id: string, userId: string): Task<void> {
		const { lobbies, liveLobbies } = this.services;
		if (collection === 'lobbies_live') {
			return liveLobbies.ownRowById(id, userId).andThen((row) => liveLobbies.removeRow(row));
		}

		return lobbies.remove(id, userId);
	}
}
