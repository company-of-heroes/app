import type {
	CommentsResponse,
	LobbiesResponse,
	LobbyCommentsResponse,
	UsersResponse
} from '$core/pocketbase/types';
import type { Expand } from '@fknoobs/app';
import type { ListResult, UnsubscribeFunc } from 'pocketbase';
import { exp, pocketbase } from '$core/pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
import { account } from '$core/account';
import { map } from 'lodash-es';

export type Comment = LobbyCommentsResponse<{
	lobby: LobbiesResponse;
	comment: {
		isReplying?: boolean;
	} & CommentsResponse<{
		sender: UsersResponse<Record<string, any>, string[]>;
	}>;
}>;

export type CommentExpanded = Expand<
	CommentsResponse<{
		parent: CommentExpanded | undefined;
		sender: UsersResponse<Record<string, any>, string[]>;
		mentions: UsersResponse<Record<string, any>, string[]>[];
	}>
> & {
	isReplying?: boolean;
};

const COMMENT_EXPAND = 'sender,mentions,parent,parent.sender,parent.mentions';
const MATCH_COMMENT_EXPAND =
	'lobby,comment,comment.sender,comment.mentions,comment.parent,comment.parent.sender,comment.parent.mentions';

const MAX_COMMENT_LENGTH = 2000;

function validateText(text: string): string {
	const trimmed = text.trim();

	if (trimmed === '') {
		throw new Error('Comment cannot be empty');
	}

	if (trimmed.length > MAX_COMMENT_LENGTH) {
		throw new Error(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`);
	}

	return trimmed;
}

/**
 * Comments on matches (stored as `comments` linked through `lobby_comments`).
 */
export class Comments {
	/** Top-level comments for a match, newest first. */
	getForMatch(
		matchId: string,
		page: number = 1,
		perPage: number = 25
	): Promise<ListResult<CommentExpanded>> {
		return pocketbase
			.collection('lobby_comments')
			.getList<Comment>(page, perPage, {
				filter: `lobby="${matchId}"`,
				sort: '-created',
				expand: MATCH_COMMENT_EXPAND,
				fetch
			})
			.then((result) => ({
				...result,
				items: map(result.items, (item) => exp(item.expand.comment) as unknown as CommentExpanded)
			}));
	}

	/** Replies to a comment, newest first. */
	getReplies(
		commentId: string,
		page: number = 1,
		perPage: number = 50
	): Promise<ListResult<CommentExpanded>> {
		return pocketbase
			.collection('comments')
			.getList<CommentsResponse>(page, perPage, {
				filter: `parent="${commentId}"`,
				sort: '-created',
				expand: COMMENT_EXPAND,
				fetch
			})
			.then((result) => ({
				...result,
				items: result.items.map(exp) as unknown as CommentExpanded[]
			}));
	}

	/** Creates a top-level comment on a match. */
	async createForMatch(matchId: string, text: string): Promise<CommentExpanded> {
		const comment = await pocketbase.collection('comments').create<CommentsResponse>(
			{
				sender: account.userId,
				isDeleted: false,
				text: validateText(text)
			},
			{ expand: COMMENT_EXPAND, fetch }
		);

		await pocketbase
			.collection('lobby_comments')
			.create({ lobby: matchId, comment: comment.id }, { fetch });

		return exp(comment) as unknown as CommentExpanded;
	}

	/** Creates a reply to an existing comment. */
	async createReply(
		parentCommentId: string,
		text: string,
		mentions?: string[]
	): Promise<CommentExpanded> {
		const reply = await pocketbase.collection('comments').create<CommentsResponse>(
			{
				sender: account.userId,
				isDeleted: false,
				text: validateText(text),
				parent: parentCommentId,
				mentions
			},
			{ expand: COMMENT_EXPAND, fetch }
		);

		return exp(reply) as unknown as CommentExpanded;
	}

	/**
	 * Toggles the current user's like. Removes an existing dislike so a user
	 * can never hold both reactions.
	 */
	async toggleLike(comment: Pick<CommentExpanded, 'id' | 'likes' | 'dislikes'>): Promise<CommentExpanded> {
		const userId = account.userId;
		const hasLike = comment.likes?.includes(userId);

		const updated = await pocketbase.collection('comments').update<CommentsResponse>(
			comment.id,
			{
				[hasLike ? 'likes-' : 'likes+']: userId,
				...(comment.dislikes?.includes(userId) ? { 'dislikes-': userId } : {})
			},
			{ expand: COMMENT_EXPAND, fetch }
		);

		return exp(updated) as unknown as CommentExpanded;
	}

	/** Toggles the current user's dislike (removing an existing like). */
	async toggleDislike(
		comment: Pick<CommentExpanded, 'id' | 'likes' | 'dislikes'>
	): Promise<CommentExpanded> {
		const userId = account.userId;
		const hasDislike = comment.dislikes?.includes(userId);

		const updated = await pocketbase.collection('comments').update<CommentsResponse>(
			comment.id,
			{
				[hasDislike ? 'dislikes-' : 'dislikes+']: userId,
				...(comment.likes?.includes(userId) ? { 'likes-': userId } : {})
			},
			{ expand: COMMENT_EXPAND, fetch }
		);

		return exp(updated) as unknown as CommentExpanded;
	}

	/**
	 * Subscribes to new comments on a match. The callback fires for every
	 * created link record; callers typically refetch the first page.
	 */
	subscribeToMatch(matchId: string, callback: () => void): Promise<UnsubscribeFunc> {
		return pocketbase.collection('lobby_comments').subscribe(
			'*',
			(event) => {
				if (event.action === 'create' && event.record.lobby === matchId) {
					callback();
				}
			},
			{ fetch }
		);
	}
}
