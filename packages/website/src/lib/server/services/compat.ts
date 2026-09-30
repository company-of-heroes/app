import { err, errAsync, ok, type Result } from 'neverthrow';
import { badRequest, forbidden, notFound, type AppError } from '../errors';
import { fromPb, type Task } from '../result';
import { COMPAT_COLLECTIONS, type CompatCollection } from './social-compat';
import type { RecordOptions } from './lobbies';
import { Service } from './service';

export type CompatActor = { id: string; isStaff: boolean };
type Body = Record<string, unknown>;

/** A PocketBase-style record write, as older apps send it. */
type CompatHandler = {
	create(
		body: Body,
		files: Record<string, File>,
		actor: CompatActor,
		options: RecordOptions
	): Task<unknown>;
	update(
		id: string,
		body: Body,
		files: Record<string, File>,
		actor: CompatActor,
		options: RecordOptions
	): Task<unknown>;
	remove(id: string, actor: CompatActor): Task<void>;
};

const staffOnly = (actor: CompatActor): Result<void, AppError> =>
	actor.isStaff ? ok(undefined) : err(forbidden('Only superusers can perform this action.'));

/**
 * Older app versions write straight to PocketBase collections; the api-gateway
 * sends those writes to /api/v1/compat/collections/{collection}/records[/{id}].
 * This table routes each collection to the service that owns its writes.
 */
export class CompatService extends Service {
	#handlers?: Record<string, CompatHandler>;

	private get handlers(): Record<string, CompatHandler> {
		return (this.#handlers ??= this.buildHandlers());
	}

	get collections(): string[] {
		return Object.keys(this.handlers);
	}

	handler(collection: string): Result<CompatHandler, AppError> {
		const found = this.handlers[collection];
		return found ? ok(found) : err(notFound("The requested resource wasn't found."));
	}

	private buildHandlers(): Record<string, CompatHandler> {
		const { socialCompat, lobbyCompat, hiddenMatches } = this.services;
		const pb = this.pb;

		const social = (collection: CompatCollection): CompatHandler => ({
			create: (body, _files, actor, options) =>
				socialCompat.create(collection, body, actor, options),
			update: (id, body, _files, actor, options) =>
				socialCompat.update(collection, id, body, actor, options),
			remove: (id, actor) => socialCompat.remove(collection, id, actor)
		});

		const lobby = (collection: 'lobbies' | 'lobbies_live'): CompatHandler => ({
			create: (body, _files, actor, options) =>
				lobbyCompat.create(collection, body, actor.id, options),
			update: (id, body, files, actor, options) =>
				lobbyCompat.update(collection, id, body, files, actor.id, options),
			remove: (id, actor) => lobbyCompat.remove(collection, id, actor.id)
		});

		return {
			...Object.fromEntries(
				COMPAT_COLLECTIONS.map((collection) => [collection, social(collection)])
			),
			lobbies: lobby('lobbies'),
			lobbies_live: lobby('lobbies_live'),
			hidden_matches: {
				create: (body, _files, actor) =>
					staffOnly(actor).asyncAndThen(() => hiddenMatches.hide(Number(body.sessionId), actor.id)),
				update: () =>
					errAsync(badRequest('Hidden matches cannot be changed; unhide and hide again.')),
				remove: (id, actor) =>
					staffOnly(actor)
						.asyncAndThen(() =>
							fromPb(
								pb.collection('hidden_matches').getOne<{ sessionId: number }>(id),
								'Hidden match not found'
							)
						)
						.andThen((row) => hiddenMatches.unhide(Number(row.sessionId)))
			},
			hidden_match_keywords: {
				create: (body, _files, actor) =>
					staffOnly(actor).asyncAndThen(() => hiddenMatches.addKeyword(body.word, actor.id)),
				update: (id, body, _files, actor) =>
					staffOnly(actor).asyncAndThen(() => hiddenMatches.updateKeyword(id, body.word)),
				remove: (id, actor) => staffOnly(actor).asyncAndThen(() => hiddenMatches.removeKeyword(id))
			}
		};
	}
}
