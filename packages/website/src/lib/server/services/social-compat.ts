import type { RecordModel } from 'pocketbase';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { badRequest, forbidden, notFound } from '../errors';
import { fromPb, pbMaybe, type Task } from '../result';
import { Service } from './service';
import type { SocialActor, TargetKind, Vote } from './social';

/**
 * Older app versions write social rows straight to PocketBase collections. The
 * api-gateway sends those writes here; each one becomes the matching service call
 * and the response is the PocketBase record, as the SDK expects.
 */
export const COMPAT_COLLECTIONS = [
	'lobby_likes',
	'replay_likes',
	'lobby_comments',
	'replay_comments',
	'lobby_comment_likes',
	'replay_comment_likes',
	'player_likes'
] as const;
export type CompatCollection = (typeof COMPAT_COLLECTIONS)[number];

type Body = Record<string, unknown>;
type RecordOptions = { expand?: string; fields?: string };
const kindOf = (collection: string): TargetKind =>
	collection.startsWith('replay_') ? 'replay' : 'lobby';
const voteOf = (value: unknown): Vote => (Number(value) === -1 ? -1 : 1);
const targetField = (collection: CompatCollection) =>
	kindOf(collection) === 'replay' ? 'replay' : 'lobby';
const missing = () => notFound("The requested resource wasn't found.");

/** What a vote row points at. */
const voteTarget = (collection: CompatCollection, row: Body) => ({
	target: String(row[targetField(collection)] ?? ''),
	comment: String(row.comment ?? ''),
	steamId: String(row.steamId ?? '')
});

export class SocialCompatService extends Service {
	private ownRow(collection: CompatCollection, id: string, actor: SocialActor): Task<Body> {
		return pbMaybe(this.pb.collection(collection).getOne<Body>(id)).andThen((row) => {
			const isComment = collection.endsWith('_comments');
			if (!row || (row.user !== actor.id && !(isComment && actor.isStaff))) {
				return err(missing());
			}

			return ok(row);
		});
	}

	private vote(
		collection: CompatCollection,
		row: { target?: string; comment?: string; steamId?: string },
		userId: string,
		value: Vote
	): Task<string> {
		if (collection === 'player_likes') {
			return this.services.playerSocial
				.vote(row.steamId ?? '', userId, value)
				.map((vote) => vote.recordId);
		}

		if (collection.endsWith('_comment_likes')) {
			return this.services.social
				.voteComment(kindOf(collection), row.comment ?? '', userId, value)
				.map((vote) => vote.recordId);
		}

		return this.services.social
			.vote({ kind: kindOf(collection), id: row.target ?? '' }, userId, value)
			.map((vote) => vote.recordId);
	}

	private record(collection: CompatCollection, id: string, options: RecordOptions) {
		return fromPb(this.pb.collection(collection).getOne(id, options), 'Record not found');
	}

	create(
		collection: CompatCollection,
		body: Body,
		actor: SocialActor,
		options: RecordOptions
	): Task<RecordModel> {
		if (body.user !== actor.id) {
			return errAsync(badRequest('Failed to create record.'));
		}

		const created = collection.endsWith('_comments')
			? this.services.social
					.comment(
						{ kind: kindOf(collection), id: String(body[targetField(collection)] ?? '') },
						actor.id,
						String(body.text ?? ''),
						body.parent ? String(body.parent) : undefined
					)
					.map((comment) => comment.id)
			: this.vote(collection, voteTarget(collection, body), actor.id, voteOf(body.value));
		return created.andThen((id) => this.record(collection, id, options));
	}

	/** A comment edit or soft delete through the PocketBase record shape. */
	private updateComment(
		collection: CompatCollection,
		id: string,
		body: Body,
		actor: SocialActor
	): Task<unknown> {
		const kind = kindOf(collection);
		if (body.deleted === true || body.deleted === 'true') {
			return this.services.social.deleteComment(
				kind,
				id,
				actor,
				body.deletedNote ? String(body.deletedNote) : undefined
			);
		}

		return typeof body.text === 'string'
			? this.services.social.editComment(kind, id, actor.id, body.text)
			: okAsync(undefined);
	}

	update(
		collection: CompatCollection,
		id: string,
		body: Body,
		actor: SocialActor,
		options: RecordOptions
	): Task<RecordModel> {
		return this.ownRow(collection, id, actor)
			.andThen((row): Task<unknown> => {
				if (collection.endsWith('_comments')) {
					return this.updateComment(collection, id, body, actor);
				}

				const value = Number(body.value);
				return value === 1 || value === -1
					? this.vote(collection, voteTarget(collection, row), actor.id, value)
					: errAsync(badRequest('Vote must be 1 or -1'));
			})
			.andThen(() => this.record(collection, id, options));
	}

	remove(collection: CompatCollection, id: string, actor: SocialActor): Task<void> {
		if (collection.endsWith('_comments')) {
			return errAsync(forbidden('Only superusers can perform this action.'));
		}

		return this.ownRow(collection, id, actor)
			.andThen((row) => this.vote(collection, voteTarget(collection, row), actor.id, 0))
			.map(() => undefined);
	}
}
