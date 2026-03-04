import type {
	CommentsResponse,
	LobbiesResponse,
	LobbyCommentsResponse,
	UsersResponse
} from '$core/pocketbase/types';
import { exp, pocketbase } from '$core/pocketbase';
import { app } from '../context';
import type { Expand } from '@fknoobs/app';
import type { ListResult } from 'pocketbase';
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

export class Comments {
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
				expand: 'sender,mentions,parent,parent.sender,parent.mentions'
			})
			.then((result) => {
				return {
					...result,
					items: result.items.map(exp) as unknown as CommentExpanded[]
				};
			});
	}

	getLobbyComments(
		lobbyId: string,
		page: number = 1,
		perPage: number = 50
	): Promise<ListResult<CommentExpanded>> {
		return pocketbase
			.collection('lobby_comments')
			.getList<Comment>(page, perPage, {
				filter: `lobby="${lobbyId}"`,
				sort: '-created',
				expand:
					'lobby,comment,comment.sender,comment.mentions,comment.parent,comment.parent.sender,comment.parent.mentions'
			})
			.then(async (result) => {
				return {
					...result,
					items: map(result.items, (item) => exp(item.expand.comment) as unknown as CommentExpanded)
				};
			});
	}

	createLobbyComment(lobbyId: string, text: string): Promise<Comment> {
		return pocketbase
			.collection('comments')
			.create({
				sender: app.features.auth.userId,
				isDeleted: false,
				text
			})
			.then((comment) =>
				pocketbase.collection('lobby_comments').create<Comment>({
					lobby: lobbyId,
					comment: comment.id
				})
			);
	}

	createReply(parentCommentId: string, text: string, mentions?: string[]): Promise<Comment> {
		return pocketbase.collection('comments').create({
			sender: app.features.auth.userId,
			isDeleted: false,
			text,
			parent: parentCommentId,
			mentions
		});
	}

	addLike(commentId: string): Promise<Comment> {
		return pocketbase.collection('comments').update(commentId, {
			'likes+': app.features.auth.userId
		});
	}

	addDislike(commentId: string): Promise<Comment> {
		return pocketbase.collection('comments').update(commentId, {
			'dislikes+': app.features.auth.userId
		});
	}
}
