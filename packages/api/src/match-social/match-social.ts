import { ClientResponseError, type RecordModel } from 'pocketbase';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { voteFromRecord, type CommentVoteValue } from '@company-of-heroes/ui/comment/vote';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import {
	currentUserId,
	escapePocketBaseString,
	fromClientError,
	fromPbPromise,
	pbOptions,
	recordId,
	requireAuth
} from '../pb';

export type CommentAuthor = {
	id: string;
	name: string;
	avatarUrl?: string;
	avatar?: string;
	collectionId?: string;
	collectionName?: string;
	steamIds?: string[];
};

export type LobbyComment = {
	id: string;
	text: string;
	created: string;
	updated: string;
	parent: string;
	likeCount: number;
	vote: CommentVoteValue;
	deleted: boolean;
	deletedNote: string;
	user: CommentAuthor;
};

/** Same shape as lobby comments; used for member replay threads. */
export type ReplayComment = LobbyComment;

export type MentionUser = {
	id: string;
	name: string;
	avatarUrl?: string;
	avatar?: string;
	collectionId?: string;
	collectionName?: string;
	steamIds?: string[];
};

const userSchema = z
	.object({
		id: z.string(),
		name: z.string().optional(),
		avatar: z.string().optional(),
		collectionId: z.string().optional(),
		collectionName: z.string().optional(),
		steamIds: z.array(z.union([z.string(), z.number()])).optional()
	})
	.passthrough();

type PbUser = z.infer<typeof userSchema>;

export class MatchSocialApi {
	constructor(private deps: ApiDeps) {}

	searchMentionUsers(query: string): ResultAsync<MentionUser[], ApiError> {
		const q = query.trim();
		if (q.length < 1) {
			return okAsync([]);
		}

		const escaped = escapePocketBaseString(q);
		const me = currentUserId(this.deps);
		const filter = `name ~ "${escaped}" && name != ""${me ? ` && id != "${me}"` : ''}`;

		return fromPbPromise(
			this.deps.pocketbase.collection('users').getList(1, 6, pbOptions(this.deps, {
				filter,
				fields: 'id,name,avatar,collectionId,collectionName,steamIds',
				sort: 'name'
			})),
			'Failed to search users.'
		).map((response) =>
			response.items
				.map((item) => {
					const parsed = userSchema.safeParse(item);
					return parsed.success ? this.serializeMention(parsed.data) : null;
				})
				.filter((user): user is MentionUser => user !== null)
		);
	}

	getMyVote(lobbyId: string): ResultAsync<CommentVoteValue, ApiError> {
		return fromPbPromise(this.findMyLobbyVote(lobbyId), 'Failed to load vote.');
	}

	getMyReplayVote(replayId: string): ResultAsync<CommentVoteValue, ApiError> {
		return fromPbPromise(this.findMyReplayVote(replayId), 'Failed to load vote.');
	}

	setLobbyVote(
		lobbyId: string,
		value: 1 | -1
	): ResultAsync<{ vote: CommentVoteValue; likeCount: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.setLobbyVoteRecord(lobbyId, auth.value, value),
			'Failed to update vote.'
		);
	}

	setReplayVote(
		replayId: string,
		value: 1 | -1
	): ResultAsync<{ vote: CommentVoteValue; likeCount: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.setReplayVoteRecord(replayId, auth.value, value),
			'Failed to update vote.'
		);
	}

	listComments(lobbyId: string): ResultAsync<LobbyComment[], ApiError> {
		const escaped = escapePocketBaseString(lobbyId);
		return fromPbPromise(
			this.deps.pocketbase.collection('lobby_comments').getList(1, 200, pbOptions(this.deps, {
				filter: `lobby = "${escaped}"`,
				sort: 'created',
				expand: 'user'
			})),
			'Failed to load comments.'
		).andThen((response) =>
			fromPbPromise(
				this.listMyCommentVotes(response.items.map((item) => item.id), 'lobby_comment_likes'),
				'Failed to load comments.'
			).map((votes) =>
				response.items.map((item) => this.serializeComment(item, votes.get(item.id) ?? 0))
			)
		);
	}

	listReplayComments(replayId: string): ResultAsync<ReplayComment[], ApiError> {
		const escaped = escapePocketBaseString(replayId);
		return fromPbPromise(
			this.deps.pocketbase.collection('replay_comments').getList(1, 200, pbOptions(this.deps, {
				filter: `replay = "${escaped}"`,
				sort: 'created',
				expand: 'user'
			})),
			'Failed to load comments.'
		).andThen((response) =>
			fromPbPromise(
				this.listMyCommentVotes(response.items.map((item) => item.id), 'replay_comment_likes'),
				'Failed to load comments.'
			).map((votes) =>
				response.items.map((item) => this.serializeComment(item, votes.get(item.id) ?? 0))
			)
		);
	}

	createComment(
		lobbyId: string,
		text: string,
		parentId?: string
	): ResultAsync<LobbyComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const trimmed = text.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Enter a comment.'));
		}

		const data: Record<string, string> = {
			lobby: lobbyId,
			user: auth.value,
			text: trimmed
		};
		if (parentId) {
			data.parent = parentId;
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobby_comments')
				.create(data, pbOptions(this.deps, { expand: 'user' })),
			'Failed to post comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	createReplayComment(
		replayId: string,
		text: string,
		parentId?: string
	): ResultAsync<ReplayComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const trimmed = text.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Enter a comment.'));
		}

		const data: Record<string, string> = {
			replay: replayId,
			user: auth.value,
			text: trimmed
		};
		if (parentId) {
			data.parent = parentId;
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('replay_comments')
				.create(data, pbOptions(this.deps, { expand: 'user' })),
			'Failed to post comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	setCommentVote(
		commentId: string,
		value: 1 | -1
	): ResultAsync<{ vote: CommentVoteValue; likeCount: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.setCommentVoteRecord(commentId, auth.value, value, 'lobby'),
			'Failed to update vote.'
		);
	}

	setReplayCommentVote(
		commentId: string,
		value: 1 | -1
	): ResultAsync<{ vote: CommentVoteValue; likeCount: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			this.setCommentVoteRecord(commentId, auth.value, value, 'replay'),
			'Failed to update vote.'
		);
	}

	updateComment(commentId: string, text: string): ResultAsync<LobbyComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const trimmed = text.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Enter a comment.'));
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobby_comments')
				.update(commentId, { text: trimmed }, pbOptions(this.deps, { expand: 'user' })),
			'Failed to update comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	updateReplayComment(commentId: string, text: string): ResultAsync<ReplayComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const trimmed = text.trim();
		if (!trimmed) {
			return errAsync(apiError(400, 'Enter a comment.'));
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('replay_comments')
				.update(commentId, { text: trimmed }, pbOptions(this.deps, { expand: 'user' })),
			'Failed to update comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	deleteComment(commentId: string, note?: string): ResultAsync<LobbyComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const data: Record<string, unknown> = { deleted: true };
		if (note) {
			data.deletedNote = note;
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('lobby_comments')
				.update(commentId, data, pbOptions(this.deps, { expand: 'user' })),
			'Failed to delete comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	deleteReplayComment(commentId: string, note?: string): ResultAsync<ReplayComment, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		const data: Record<string, unknown> = { deleted: true };
		if (note) {
			data.deletedNote = note;
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('replay_comments')
				.update(commentId, data, pbOptions(this.deps, { expand: 'user' })),
			'Failed to delete comment.'
		).map((record) => this.serializeComment(record, 0));
	}

	recordDownload(lobbyId: string): ResultAsync<number, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.send<{ downloadCount: number }>(`/api/lobbies/${lobbyId}/download`, {
				method: 'POST',
				fetch: this.deps.fetch
			}),
			'Failed to record download.'
		).map((response) => Number(response.downloadCount) || 0);
	}

	private serializeMention(user: PbUser): MentionUser | null {
		const name = String(user.name || '').trim();
		if (!user.id || !name) {
			return null;
		}

		const avatarUrl = this.resolveAvatarUrl(user);
		return {
			id: user.id,
			name,
			avatar: user.avatar || '',
			avatarUrl,
			collectionId: user.collectionId,
			collectionName: user.collectionName,
			steamIds: Array.isArray(user.steamIds) ? user.steamIds.map(String) : []
		};
	}

	private serializeComment(record: RecordModel, vote: CommentVoteValue): LobbyComment {
		const expand = record.expand as { user?: PbUser } | undefined;
		const author = expand?.user;
		const user: CommentAuthor = author
			? {
					id: author.id,
					name: String(author.name || '').trim() || 'Player',
					avatar: author.avatar || '',
					avatarUrl: this.resolveAvatarUrl(author),
					collectionId: author.collectionId,
					collectionName: author.collectionName,
					steamIds: Array.isArray(author.steamIds) ? author.steamIds.map(String) : []
				}
			: {
					id: recordId(record.user),
					name: 'Player'
				};

		return {
			id: record.id,
			text: String(record.text ?? ''),
			created: String(record.created ?? ''),
			updated: String(record.updated ?? ''),
			parent: recordId(record.parent),
			likeCount: Number(record.likeCount) || 0,
			vote,
			deleted: Boolean(record.deleted),
			deletedNote: String(record.deletedNote ?? ''),
			user
		};
	}

	private resolveAvatarUrl(user: PbUser) {
		if (!user.avatar) {
			return undefined;
		}

		return this.deps.pocketbase.files.getURL(user, user.avatar);
	}

	private async findMyLobbyVote(lobbyId: string): Promise<CommentVoteValue> {
		const userId = currentUserId(this.deps);
		if (!userId) {
			return 0;
		}

		try {
			const existing = await this.deps.pocketbase
				.collection('lobby_likes')
				.getFirstListItem(
					`lobby = "${escapePocketBaseString(lobbyId)}" && user = "${userId}"`,
					pbOptions(this.deps, { fields: 'value' })
				);
			return voteFromRecord(existing.value);
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return 0;
			}

			throw error;
		}
	}

	private async findMyReplayVote(replayId: string): Promise<CommentVoteValue> {
		const userId = currentUserId(this.deps);
		if (!userId) {
			return 0;
		}

		try {
			const existing = await this.deps.pocketbase
				.collection('replay_likes')
				.getFirstListItem(
					`replay = "${escapePocketBaseString(replayId)}" && user = "${userId}"`,
					pbOptions(this.deps, { fields: 'value' })
				);
			return voteFromRecord(existing.value);
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				return 0;
			}

			throw error;
		}
	}

	private async setLobbyVoteRecord(
		lobbyId: string,
		userId: string,
		value: 1 | -1
	): Promise<{ vote: CommentVoteValue; likeCount: number }> {
		let vote: CommentVoteValue = value;
		try {
			const existing = await this.deps.pocketbase
				.collection('lobby_likes')
				.getFirstListItem(
					`lobby = "${escapePocketBaseString(lobbyId)}" && user = "${userId}"`,
					pbOptions(this.deps)
				);
			const current = voteFromRecord(existing.value);
			if (current === value) {
				await this.deps.pocketbase
					.collection('lobby_likes')
					.delete(existing.id, pbOptions(this.deps));
				vote = 0;
			} else {
				await this.deps.pocketbase
					.collection('lobby_likes')
					.update(existing.id, { value }, pbOptions(this.deps));
			}
		} catch (error) {
			if (!(error instanceof ClientResponseError) || error.status !== 404) {
				throw error;
			}

			await this.deps.pocketbase.collection('lobby_likes').create(
				{
					lobby: lobbyId,
					user: userId,
					value
				},
				pbOptions(this.deps)
			);
		}

		try {
			const lobby = await this.deps.pocketbase
				.collection('lobbies')
				.getOne(lobbyId, pbOptions(this.deps, { fields: 'likeCount' }));
			return { vote, likeCount: Number(lobby.likeCount) || 0 };
		} catch {
			return { vote, likeCount: 0 };
		}
	}

	private async setReplayVoteRecord(
		replayId: string,
		userId: string,
		value: 1 | -1
	): Promise<{ vote: CommentVoteValue; likeCount: number }> {
		let vote: CommentVoteValue = value;
		try {
			const existing = await this.deps.pocketbase
				.collection('replay_likes')
				.getFirstListItem(
					`replay = "${escapePocketBaseString(replayId)}" && user = "${userId}"`,
					pbOptions(this.deps)
				);
			const current = voteFromRecord(existing.value);
			if (current === value) {
				await this.deps.pocketbase
					.collection('replay_likes')
					.delete(existing.id, pbOptions(this.deps));
				vote = 0;
			} else {
				await this.deps.pocketbase
					.collection('replay_likes')
					.update(existing.id, { value }, pbOptions(this.deps));
			}
		} catch (error) {
			if (!(error instanceof ClientResponseError) || error.status !== 404) {
				throw error;
			}

			await this.deps.pocketbase.collection('replay_likes').create(
				{
					replay: replayId,
					user: userId,
					value
				},
				pbOptions(this.deps)
			);
		}

		try {
			const replay = await this.deps.pocketbase
				.collection('replays')
				.getOne(replayId, pbOptions(this.deps, { fields: 'likeCount' }));
			return { vote, likeCount: Number(replay.likeCount) || 0 };
		} catch {
			return { vote, likeCount: 0 };
		}
	}

	private async listMyCommentVotes(
		commentIds: string[],
		collection: 'lobby_comment_likes' | 'replay_comment_likes'
	): Promise<Map<string, 1 | -1>> {
		const userId = currentUserId(this.deps);
		const votes = new Map<string, 1 | -1>();
		if (!userId || commentIds.length === 0) {
			return votes;
		}

		const size = 40;
		for (let i = 0; i < commentIds.length; i += size) {
			const chunk = commentIds.slice(i, i + size);
			const likes = await this.deps.pocketbase.collection(collection).getFullList(
				pbOptions(this.deps, {
					filter: `user = "${userId}" && (${chunk.map((id) => `comment = "${id}"`).join(' || ')})`,
					fields: 'comment,value'
				})
			);
			for (const like of likes) {
				votes.set(recordId(like.comment), voteFromRecord(like.value));
			}
		}

		return votes;
	}

	private async setCommentVoteRecord(
		commentId: string,
		userId: string,
		value: 1 | -1,
		target: 'lobby' | 'replay'
	): Promise<{ vote: CommentVoteValue; likeCount: number }> {
		const likesCollection = target === 'replay' ? 'replay_comment_likes' : 'lobby_comment_likes';
		const commentsCollection = target === 'replay' ? 'replay_comments' : 'lobby_comments';
		let vote: CommentVoteValue = value;
		try {
			const existing = await this.deps.pocketbase
				.collection(likesCollection)
				.getFirstListItem(
					`comment = "${commentId}" && user = "${userId}"`,
					pbOptions(this.deps)
				);
			const current = voteFromRecord(existing.value);
			if (current === value) {
				await this.deps.pocketbase
					.collection(likesCollection)
					.delete(existing.id, pbOptions(this.deps));
				vote = 0;
			} else {
				await this.deps.pocketbase
					.collection(likesCollection)
					.update(existing.id, { value }, pbOptions(this.deps));
			}
		} catch (error) {
			if (!(error instanceof ClientResponseError) || error.status !== 404) {
				throw error;
			}

			await this.deps.pocketbase.collection(likesCollection).create(
				{
					comment: commentId,
					user: userId,
					value
				},
				pbOptions(this.deps)
			);
		}

		try {
			const comment = await this.deps.pocketbase
				.collection(commentsCollection)
				.getOne(commentId, pbOptions(this.deps, { fields: 'likeCount' }));
			return { vote, likeCount: Number(comment.likeCount) || 0 };
		} catch {
			return { vote, likeCount: 0 };
		}
	}
}

export function toSocialError(error: unknown, fallback: string): ApiError {
	return fromClientError(error, fallback);
}
