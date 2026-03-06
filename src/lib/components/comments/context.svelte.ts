import type { CommentExpanded } from '$core/app/database/comments';
import type { ListResult } from 'pocketbase';
import { Context, resource, type ResourceReturn } from 'runed';
import { app } from '$core/app/context';
import { exp } from '$core/pocketbase';

export class CommentsContext {
	lobbyId: string | undefined = $state();
	replayId: string | undefined = $state();
	commentId: string | undefined = $state();

	page = $state(1);
	perPage = $derived(this.commentId ? 2 : 25);

	#query: ResourceReturn<ListResult<CommentExpanded>, unknown, false>;

	get items() {
		return this.#query.current?.items ?? [];
	}

	get totalPages() {
		return this.#query.current?.totalPages ?? 1;
	}

	get totalItems() {
		return this.#query.current?.totalItems ?? 0;
	}

	get isReply() {
		return !!this.commentId && !this.lobbyId;
	}

	constructor() {
		this.#query = resource(
			() => [this.lobbyId, this.commentId, this.replayId, this.page, this.perPage],
			async () => {
				if (this.lobbyId) {
					return app.database.comments.getLobbyComments(this.lobbyId, this.page, this.perPage);
				}

				if (this.commentId) {
					return app.database.comments.getReplies(this.commentId, this.page, this.perPage);
				}
			}
		);

		$inspect(this.items);
	}

	init(lobbyId?: string, commentId?: string, replayId?: string) {
		this.lobbyId = lobbyId;
		this.commentId = commentId;
		this.replayId = replayId;
	}

	addComment(comment: CommentExpanded) {
		if (!this.#query.current) {
			return;
		}

		this.#query.mutate({
			...this.#query.current,
			items: [exp(comment) as unknown as CommentExpanded, ...this.items]
		});
	}
}

const commentsContext = new Context<CommentsContext>('<comments />');
export const createComments = () => commentsContext.set(new CommentsContext());
export const useComments = () => commentsContext.get();
