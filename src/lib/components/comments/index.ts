import type { HTMLAttributes } from 'svelte/elements';
import type { CommentsContext } from './context.svelte';
import Comments from './comments.svelte';
import CommentsEditor from './comments-editor.svelte';
import CommentsList from './comments-list.svelte';
import CommentsTotal from './comments-total.svelte';

export type CommentsRootProps = {
	commentId?: string;
	lobbyId?: string;
	replayId?: string;
	context?: CommentsContext;
} & HTMLAttributes<HTMLDivElement>;

export { Comments as Root, CommentsEditor as Editor, CommentsList as List, CommentsTotal as Count };
