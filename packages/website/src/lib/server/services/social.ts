import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { badRequest, forbidden, notFound } from '../errors';
import { chunk, ensure, fromPb, pbMaybe, sequence, type Task } from '../result';
import { commentSnippet, mentionedUserIds, MAX_COMMENT_DEPTH } from '../domain/comments';
import { normalizeSteamId, parseJsonList } from '../domain/member-replays';
import type { LobbyComment } from '@company-of-heroes/api';
import { Service } from './service';

export type TargetKind = 'lobby' | 'replay';
/** A community match (`lobbies`) or a member replay (`replays`). */
export type Target = { kind: TargetKind; id: string };
export type Vote = 1 | -1 | 0;
export type SocialActor = { id: string; isStaff: boolean };

/** Collection names and fields per target kind; everything else is shared. */
const KIND = {
	lobby: {
		records: 'lobbies',
		field: 'lobby',
		owner: 'user',
		likes: 'lobby_likes',
		comments: 'lobby_comments',
		commentLikes: 'lobby_comment_likes',
		counts: 'lobby_social_counts',
		commentScores: 'lobby_comment_scores',
		fingerprints: 'lobby_download_fingerprints',
		noun: 'match',
		notifyComment: 'comment'
	},
	replay: {
		records: 'replays',
		field: 'replay',
		owner: 'createdBy',
		likes: 'replay_likes',
		comments: 'replay_comments',
		commentLikes: 'replay_comment_likes',
		counts: 'replay_social_counts',
		commentScores: 'replay_comment_scores',
		fingerprints: 'member_replay_download_fingerprints',
		noun: 'replay',
		notifyComment: 'replayComment'
	}
} as const;

type CommentRecord = {
	id: string;
	user: string;
	text: string;
	parent: string;
	deleted: boolean;
	lobby?: string;
	replay?: string;
};
const notFoundFor = (kind: TargetKind) =>
	notFound(kind === 'lobby' ? 'Match not found' : 'Replay not found');

type Counts = { likeCount: number; commentCount: number; downloadCount: number };
type StoredVote = { id: string; previous: Vote; value: Vote };

export class SocialService extends Service {
	private findOne<T>(collection: string, filter: string): Task<T | null> {
		return fromPb(
			this.pb.collection(collection).getList<T>(1, 1, { filter, skipTotal: true }),
			`Could not load ${collection}`
		).map((rows) => rows.items[0] ?? null);
	}

	private getOrNull<T>(collection: string, id: string): Task<T | null> {
		return pbMaybe(this.pb.collection(collection).getOne<T>(id), `Could not load ${collection}`);
	}

	private ownerOf(target: Target): Task<string> {
		return this.getOrNull<Record<string, string>>(KIND[target.kind].records, target.id).andThen(
			(record) =>
				record ? ok(record[KIND[target.kind].owner] ?? '') : err(notFoundFor(target.kind))
		);
	}

	/** Owner of a match or replay the public can see: hidden matches and unpublished replays are not found. */
	private visibleOwnerOf(target: Target): Task<string> {
		return this.getOrNull<Record<string, unknown>>(KIND[target.kind].records, target.id).andThen(
			(record) => {
				const visible =
					!!record &&
					(target.kind === 'lobby' ? !record.isHidden : record.visibility === 'member');
				return visible
					? ok(String(record[KIND[target.kind].owner] ?? ''))
					: err(notFoundFor(target.kind));
			}
		);
	}

	/** Stored counters follow the count views (the source of truth). */
	recount(target: Target): Task<Counts> {
		const kind = KIND[target.kind];
		return fromPb(this.pb.collection(kind.counts).getOne<Counts>(target.id), 'Could not count')
			.map((counts) => ({
				likeCount: counts.likeCount,
				commentCount: counts.commentCount,
				downloadCount: counts.downloadCount
			}))
			.andThen((next) =>
				fromPb(
					this.pb.collection(kind.records).update(target.id, next),
					'Could not update counters'
				).map(() => next)
			);
	}

	private recountComment(kind: TargetKind, commentId: string): Task<number> {
		return fromPb(
			this.pb.collection(KIND[kind].commentScores).getOne<{ likeCount: number }>(commentId),
			'Comment not found'
		).andThen(({ likeCount }) =>
			fromPb(
				this.pb.collection(KIND[kind].comments).update(commentId, { likeCount }),
				'Could not update comment'
			).map(() => likeCount)
		);
	}

	/**
	 * Upserts (or with 0, removes) a user's single vote row. With `toggle`, voting
	 * the same way again removes the vote (the UI's click behaviour). Returns the
	 * row id the vote is stored under (the reputation ledger's source).
	 */
	private upsertVote(
		collection: string,
		keys: Record<string, string>,
		requested: Vote,
		toggle: boolean
	): Task<StoredVote> {
		const rows = this.pb.collection(collection);
		const filter = Object.entries(keys)
			.map(([field, key]) => this.pb.filter(`${field} = {:value}`, { value: key }))
			.join(' && ');
		return this.findOne<{ id: string; value: number }>(collection, filter).andThen(
			(existing): Task<StoredVote> => {
				const previous: Vote = existing ? (Number(existing.value) === -1 ? -1 : 1) : 0;
				const value: Vote = toggle && requested === previous ? 0 : requested;
				const stored = (id: string) => ({ id, previous, value });
				if (value === 0) {
					return existing
						? fromPb(rows.delete(existing.id), 'Could not remove vote').map(() =>
								stored(existing.id)
							)
						: okAsync(stored(''));
				}

				if (existing) {
					return previous === value
						? okAsync(stored(existing.id))
						: fromPb(rows.update(existing.id, { value }), 'Could not save vote').map(() =>
								stored(existing.id)
							);
				}

				return fromPb(rows.create<{ id: string }>({ ...keys, value }), 'Could not save vote').map(
					(created) => stored(created.id)
				);
			}
		);
	}

	/** Moves the reputation that follows a changed vote. */
	private voteReputation(
		stored: StoredVote,
		voterId: string,
		authorId: string,
		prefix: 'replay' | 'comment'
	): Task<void> {
		if (!stored.id || stored.previous === stored.value) {
			return okAsync(undefined);
		}

		return this.services.reputation.setVote({
			voterId,
			authorId,
			sourceId: stored.id,
			value: stored.value,
			prefix
		});
	}

	/** Up/down vote on a match or replay (0 removes the vote). */
	vote(
		target: Target,
		userId: string,
		value: Vote,
		{ toggle = false } = {}
	): Task<{ vote: Vote; likeCount: number; recordId: string }> {
		const kind = KIND[target.kind];
		return this.visibleOwnerOf(target).andThen((authorId) =>
			this.upsertVote(kind.likes, { [kind.field]: target.id, user: userId }, value, toggle)
				.andThen((stored) =>
					this.voteReputation(stored, userId, authorId, 'replay').map(() => stored)
				)
				.andThen((stored) =>
					this.recount(target).map((counts) => ({
						vote: stored.value,
						likeCount: counts.likeCount,
						recordId: stored.id
					}))
				)
		);
	}

	private liveComment(kind: TargetKind, commentId: string): Task<CommentRecord> {
		return this.getOrNull<CommentRecord>(KIND[kind].comments, commentId).andThen((comment) => {
			if (!comment) {
				return err(notFound('Comment not found'));
			}

			if (comment.deleted) {
				return err(badRequest('That comment was deleted'));
			}

			return ok(comment);
		});
	}

	/** How many parents above the comment (stops past the maximum depth). */
	private depthOf(kind: TargetKind, commentId: string, depth = 0): Task<number> {
		return this.getOrNull<CommentRecord>(KIND[kind].comments, commentId).andThen((current) =>
			current?.parent && depth <= MAX_COMMENT_DEPTH
				? this.depthOf(kind, current.parent, depth + 1)
				: okAsync(depth)
		);
	}

	/** A reply must go under a live comment on the same target, within the depth limit. */
	private checkParent(target: Target, parentId: string | undefined): Task<void> {
		if (!parentId) {
			return okAsync(undefined);
		}

		const kind = KIND[target.kind];
		return this.getOrNull<CommentRecord>(kind.comments, parentId)
			.andThen((parent) => {
				if (!parent) {
					return err(badRequest('Parent comment not found'));
				}

				if (parent.deleted) {
					return err(badRequest('Cannot reply to a deleted comment'));
				}

				return ensure(
					parent[kind.field] === target.id,
					badRequest(`Reply must be on the same ${kind.noun}`)
				);
			})
			.andThen(() => this.depthOf(target.kind, parentId))
			.andThen((depth) =>
				ensure(depth + 1 <= MAX_COMMENT_DEPTH, badRequest('Reply is nested too deep'))
			);
	}

	/** Posts a comment (or a reply), then notifies players, the uploader, earlier commenters and mentions. */
	comment(target: Target, userId: string, text: string, parentId?: string): Task<CommentRecord> {
		const kind = KIND[target.kind];
		const body = text.trim();
		return ensure(body, badRequest('Enter a comment.'))
			.andThen(() => ensure(body.length <= 5000, badRequest('That comment is too long.')))
			.asyncAndThen(() => this.visibleOwnerOf(target))
			.andThen(() => this.checkParent(target, parentId))
			.andThen(() =>
				fromPb(
					this.pb.collection(kind.comments).create<CommentRecord>({
						[kind.field]: target.id,
						user: userId,
						text: body,
						parent: parentId ?? '',
						likeCount: 0,
						deleted: false
					}),
					'Could not post comment'
				)
			)
			.andThen((created) =>
				this.recount(target)
					.andThen(() => this.services.reputation.award(userId, 'comment_created', created.id))
					.andThen(() =>
						this.notifyComment(target, created).orElse((error) => {
							console.warn('[social] notify failed', error);
							return ok(undefined);
						})
					)
					.map(() => created)
			);
	}

	/** Authors edit their own live comments. */
	editComment(
		kind: TargetKind,
		commentId: string,
		userId: string,
		text: string
	): Task<CommentRecord> {
		const body = text.trim();
		return this.liveComment(kind, commentId)
			.andThen((existing) =>
				ensure(existing.user === userId, forbidden('You can only edit your own comments.'))
			)
			.andThen(() => ensure(body, badRequest('Enter a comment.')))
			.andThen(() =>
				fromPb(
					this.pb.collection(KIND[kind].comments).update<CommentRecord>(commentId, { text: body }),
					'Could not edit comment'
				)
			);
	}

	/** Soft delete by the author, or by staff with a reason (shown instead of the text). */
	deleteComment(
		kind: TargetKind,
		commentId: string,
		actor: SocialActor,
		note?: string
	): Task<CommentRecord> {
		// Staff deletions always carry a reason, shown in place of the text.
		const reason = (note ?? '').trim();
		return this.getOrNull<CommentRecord>(KIND[kind].comments, commentId).andThen((existing) => {
			if (!existing) {
				return errAsync(notFound('Comment not found'));
			}

			if (existing.deleted) {
				return okAsync(existing);
			}

			return ensure(
				actor.isStaff || existing.user === actor.id,
				forbidden('You can only delete your own comments.')
			)
				.andThen(() => ensure(!actor.isStaff || reason, badRequest('Enter a reason.')))
				.asyncAndThen(() =>
					fromPb(
						this.pb.collection(KIND[kind].comments).update<CommentRecord>(commentId, {
							deleted: true,
							deletedAt: new Date().toISOString(),
							deletedBy: actor.id,
							deletedNote: actor.isStaff ? reason.slice(0, 500) : ''
						}),
						'Could not delete comment'
					)
				)
				.andThen((updated) =>
					this.recount({ kind, id: existing[KIND[kind].field] ?? '' })
						.andThen(() =>
							this.services.reputation.revoke(existing.user, 'comment_created', commentId)
						)
						.map(() => updated)
				);
		});
	}

	/** Up/down vote on a live comment (0 removes the vote). */
	voteComment(
		kind: TargetKind,
		commentId: string,
		userId: string,
		value: Vote,
		{ toggle = false } = {}
	): Task<{ vote: Vote; likeCount: number; recordId: string }> {
		return this.liveComment(kind, commentId).andThen((existing) =>
			this.upsertVote(KIND[kind].commentLikes, { comment: commentId, user: userId }, value, toggle)
				.andThen((stored) =>
					this.voteReputation(stored, userId, existing.user, 'comment').map(() => stored)
				)
				.andThen((stored) =>
					this.recountComment(kind, commentId).map((likeCount) => ({
						vote: stored.value,
						likeCount,
						recordId: stored.id
					}))
				)
		);
	}

	/** A comment as the comment thread UI shows it, with the viewer's own vote. */
	commentView(kind: TargetKind, commentId: string, viewerId: string): Task<LobbyComment> {
		type Author = {
			id: string;
			name?: string;
			avatar?: string;
			collectionId: string;
			collectionName: string;
			steamIds?: unknown;
		};
		type Row = CommentRecord & {
			created: string;
			updated: string;
			likeCount: number;
			deletedNote: string;
			expand?: { user?: Author };
		};
		return ResultAsync.combine([
			fromPb(
				this.pb.collection(KIND[kind].comments).getOne<Row>(commentId, { expand: 'user' }),
				'Comment not found'
			),
			this.findOne<{ value: number }>(
				KIND[kind].commentLikes,
				this.pb.filter('comment = {:commentId} && user = {:viewerId}', { commentId, viewerId })
			)
		]).map(([record, myVote]): LobbyComment => {
			const author = record.expand?.user;
			return {
				id: record.id,
				text: record.text,
				created: record.created,
				updated: record.updated,
				parent: record.parent,
				likeCount: Number(record.likeCount) || 0,
				vote: myVote ? (Number(myVote.value) === -1 ? -1 : 1) : 0,
				deleted: record.deleted,
				deletedNote: record.deletedNote ?? '',
				user: author
					? {
							id: author.id,
							name: author.name?.trim() || 'Player',
							avatar: author.avatar || '',
							avatarUrl: author.avatar ? this.pb.files.getURL(author, author.avatar) : undefined,
							collectionId: author.collectionId,
							collectionName: author.collectionName,
							steamIds: Array.isArray(author.steamIds) ? author.steamIds.map(String) : []
						}
					: { id: record.user, name: 'Player' }
			};
		});
	}

	/** Whether the public may download this match or replay (staff also see hidden / deleted ones). */
	private downloadable(target: Target, isStaff: boolean): Task<{ owner: string } | null> {
		if (target.kind === 'lobby') {
			return this.getOrNull<{
				user: string;
				replay: string;
				needsResult: boolean;
				isHidden: boolean;
			}>('lobbies', target.id).map((lobby) => {
				const visible =
					!!lobby && (!!lobby.replay || lobby.needsResult) && (isStaff || !lobby.isHidden);
				return lobby && visible ? { owner: lobby.user } : null;
			});
		}

		return this.getOrNull<{ createdBy: string; file: string; visibility: string }>(
			'replays',
			target.id
		).map((replay) => {
			const visible =
				!!replay?.file &&
				(replay.visibility === 'member' || (isStaff && replay.visibility === 'deleted'));
			return replay && visible ? { owner: replay.createdBy } : null;
		});
	}

	/** Current download count, uncounted. */
	private currentDownloads(target: Target): Task<{ downloadCount: number; counted: boolean }> {
		return fromPb(
			this.pb
				.collection(KIND[target.kind].records)
				.getOne<{ downloadCount: number }>(target.id, { fields: 'downloadCount' }),
			'Could not load download count'
		).map((record) => ({ downloadCount: record.downloadCount || 0, counted: false }));
	}

	/** Whether any of these fingerprints already downloaded the target. */
	private seenBefore(target: Target, fingerprints: string[]): Task<boolean> {
		const kind = KIND[target.kind];
		const anyFingerprint = fingerprints
			.map((fingerprint) => this.pb.filter('fingerprint = {:fingerprint}', { fingerprint }))
			.join(' || ');
		return fromPb(
			this.pb.collection(kind.fingerprints).getList(1, 1, {
				filter: `${this.pb.filter(`${kind.field} = {:id}`, { id: target.id })} && (${anyFingerprint})`,
				fields: 'id',
				skipTotal: true
			}),
			'Could not load downloads'
		).map((seen) => seen.items.length > 0);
	}

	/** Stores the fingerprints; returns the first stored row id ('' when a parallel request won). */
	private storeFingerprints(target: Target, fingerprints: string[]): Task<string> {
		const kind = KIND[target.kind];
		return ResultAsync.fromSafePromise(
			Promise.all(
				fingerprints.map((fingerprint) =>
					// Unique (target, fingerprint): a parallel request may have stored it first.
					this.pb
						.collection(kind.fingerprints)
						.create<{ id: string }>({ [kind.field]: target.id, fingerprint })
						.then((row) => row.id)
						.catch(() => '')
				)
			)
		).map((ids) => ids.find(Boolean) ?? '');
	}

	/**
	 * Anonymous download: counted once per visitor, recognised by hashed IP and
	 * visitor id (`fingerprints`); the first count earns the uploader reputation.
	 */
	recordAnonymousDownload(
		target: Target,
		fingerprints: string[],
		isStaff = false
	): Task<{ downloadCount: number; counted: boolean }> {
		return this.downloadable(target, isStaff).andThen((found) => {
			if (!found) {
				return errAsync(notFoundFor(target.kind));
			}

			if (fingerprints.length === 0) {
				return this.currentDownloads(target);
			}

			return this.seenBefore(target, fingerprints).andThen((seen) =>
				seen
					? this.currentDownloads(target)
					: this.storeFingerprints(target, fingerprints).andThen((firstId) => {
							if (!firstId) {
								return this.currentDownloads(target);
							}

							return (
								found.owner
									? this.services.reputation.award(found.owner, 'replay_received_download', firstId)
									: okAsync(undefined)
							)
								.andThen(() => this.recount(target))
								.map((counts) => ({ downloadCount: counts.downloadCount, counted: true }));
						})
			);
		});
	}

	/** Signed-in download of a match replay: counted once per user. */
	recordDownload(lobbyId: string, userId: string): Task<{ downloadCount: number }> {
		const reputation = this.services.reputation;
		const firstDownload = (uploaderId: string) =>
			fromPb(
				this.pb
					.collection('lobby_downloads')
					.create<{ id: string }>({ lobby: lobbyId, user: userId }),
				'Could not record download'
			).andThen((created) =>
				uploaderId === userId
					? // No reputation for your own replay, but it still counts toward rewards.
						this.services.rewards.markDirty([{ id: userId }])
					: reputation
							.award(uploaderId, 'replay_received_download', created.id)
							.andThen(() => reputation.award(userId, 'replay_cast_download', created.id))
			);
		return this.ownerOf({ kind: 'lobby', id: lobbyId })
			.andThen((uploaderId) =>
				this.findOne<{ id: string }>(
					'lobby_downloads',
					this.pb.filter('lobby = {:lobbyId} && user = {:userId}', { lobbyId, userId })
				).andThen((existing) => (existing ? okAsync(undefined) : firstDownload(uploaderId)))
			)
			.andThen(() => this.recount({ kind: 'lobby', id: lobbyId }))
			.map((counts) => ({ downloadCount: counts.downloadCount }));
	}

	// ---- notifications ------------------------------------------------------------

	private usersBySteamIds(steamIds: string[]): Task<string[]> {
		return sequence(chunk([...new Set(steamIds)], 50), (ids) =>
			fromPb(
				this.pb.collection('users').getFullList<{ id: string }>({
					filter: ids
						.map((steamId) => this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }))
						.join(' || '),
					fields: 'id'
				}),
				'Could not load users'
			)
		).map((pages) => [...new Set(pages.flat().map((user) => user.id))]);
	}

	/** Steam accounts that played the match or appear in the replay's roster. */
	private participantSteamIds(target: Target): Task<string[]> {
		const steamIdsIn = (players: unknown) =>
			parseJsonList<{ steamId?: string }>(players)
				.map((player) => normalizeSteamId(player.steamId))
				.filter((id): id is string => !!id);
		if (target.kind === 'replay') {
			return fromPb(
				this.pb
					.collection('replays')
					.getOne<{ players: unknown }>(target.id, { fields: 'players' }),
				'Replay not found'
			).map((replay) => steamIdsIn(replay.players));
		}

		return ResultAsync.combine([
			fromPb(
				this.pb.collection('lobbies').getOne<{
					lobbyPlayers: unknown;
					result: { players?: unknown } | null;
				}>(target.id, { fields: 'lobbyPlayers,result' }),
				'Match not found'
			),
			fromPb(
				this.pb.collection('lobby_player_index').getFullList<{ steam_id: string }>({
					filter: this.pb.filter('lobby = {:id}', { id: target.id }),
					fields: 'steam_id'
				}),
				'Could not load lobby players'
			)
		]).map(([lobby, rows]) => [
			...rows.map((row) => row.steam_id).filter(Boolean),
			...steamIdsIn(lobby.lobbyPlayers),
			...steamIdsIn(lobby.result?.players)
		]);
	}

	/** Mentioned users that exist. */
	private mentionedUsers(text: string): Task<string[]> {
		const mentionIds = mentionedUserIds(text);
		if (mentionIds.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('users').getFullList<{ id: string }>({
				filter: mentionIds.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields: 'id'
			}),
			'Could not load users'
		).map((users) => users.map((user) => user.id));
	}

	/** Everyone following the target: the uploader, its players and earlier commenters. */
	private followers(target: Target, created: CommentRecord): Task<string[]> {
		const kind = KIND[target.kind];
		return ResultAsync.combine([
			this.participantSteamIds(target).andThen((steamIds) => this.usersBySteamIds(steamIds)),
			fromPb(
				this.pb.collection(kind.comments).getFullList<{ user: string }>({
					filter: this.pb.filter(`${kind.field} = {:id} && id != {:commentId}`, {
						id: target.id,
						commentId: created.id
					}),
					fields: 'user'
				}),
				'Could not load comments'
			).map((earlier) => earlier.map((row) => row.user)),
			target.kind === 'replay' ? this.ownerOf(target) : okAsync('')
		]).map(([players, commenters, uploader]) => [uploader, ...players, ...commenters]);
	}

	private notifyComment(target: Target, created: CommentRecord): Task<void> {
		const kind = KIND[target.kind];
		return ResultAsync.combine([
			this.followers(target, created),
			this.mentionedUsers(created.text),
			fromPb(
				this.pb
					.collection('users')
					.getOne<{ name: string }>(created.user, { fields: 'name' })
					.catch(() => null)
			)
		]).andThen(([followers, mentioned, author]) => {
			const mentionSet = new Set(mentioned.filter((id) => id !== created.user));
			const general = new Set(followers);
			general.delete('');
			general.delete(created.user);
			for (const id of mentionSet) {
				general.delete(id);
			}

			const name = author?.name?.trim() || 'Someone';
			const isReply = !!created.parent;
			const base = {
				body: commentSnippet(created.text) || (isReply ? 'New reply' : 'New comment'),
				targetAll: false,
				[kind.field]: target.id,
				[kind.notifyComment]: created.id,
				createdBy: created.user
			};
			const notifications = [
				{ title: `${name} mentioned you on a ${kind.noun}`, recipients: [...mentionSet] },
				{
					title: `${name} ${isReply ? 'replied' : 'commented'} on a ${kind.noun}`,
					recipients: [...general]
				}
			].filter((notification) => notification.recipients.length > 0);
			return sequence(notifications, (notification) =>
				fromPb(
					this.pb.collection('notifications').create({ ...base, ...notification }),
					'Could not notify'
				)
			).map(() => undefined);
		});
	}
}
