import * as User from '$lib/components/user';
import Comment from './comment.svelte';
import CommentText from './comment-text.svelte';
import CommentDate from './comment-date.svelte';
import CommentLike from './comment-like.svelte';
import CommentDislike from './comment-dislike.svelte';
import CommentReply from './comment-reply.svelte';
import CommentReplies from './comment-replies.svelte';
import CommentLikesCount from './comment-likes-count.svelte';
import CommentDislikesCount from './comment-dislikes-count.svelte';

export {
	Comment as Root,
	CommentText as Text,
	CommentDate as Date,
	CommentLike as Like,
	CommentDislike as Dislike,
	CommentReply as Reply,
	CommentReplies as Replies,
	CommentLikesCount as LikesCount,
	CommentDislikesCount as DislikesCount,
	User
};
