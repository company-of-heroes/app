import type { CommentExpanded } from '$core/app/database/comments';
import type { UnsubscribeFunc } from 'pocketbase';
import { Context } from 'runed';
import { app } from '$core/app/context';

/**
 * Comments list state for a match (top-level) or a comment (replies).
 *
 * Pages accumulate ("load more"); realtime creations on the match trigger a
 * refresh of the first page.
 */
export class CommentsContext {
	matchId: string | undefined = $state();
	commentId: string | undefined = $state();

	perPage = $state(25);

	items = $state<CommentExpanded[]>([]);
	totalItems = $state(0);
	totalPages = $state(1);
	isLoading = $state(false);

	#page = 1;
	#unsubscribe: UnsubscribeFunc | null = null;

	get hasMore(): boolean {
		return this.#page < this.totalPages;
	}

	async init(matchId?: string, commentId?: string): Promise<void> {
		if (this.matchId === matchId && this.commentId === commentId) {
			return;
		}

		this.matchId = matchId;
		this.commentId = commentId;

		await this.refresh();

		this.#unsubscribe?.();
		this.#unsubscribe = null;

		if (matchId) {
			this.#unsubscribe = await app.database.comments
				.subscribeToMatch(matchId, () => void this.refresh())
				.catch(() => null);
		}
	}

	/** Reloads the first page. */
	async refresh(): Promise<void> {
		this.#page = 1;
		await this.#fetch(false);
	}

	/** Appends the next page. */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.isLoading) {
			return;
		}

		this.#page += 1;
		await this.#fetch(true);
	}

	async #fetch(append: boolean): Promise<void> {
		this.isLoading = true;

		try {
			const result = this.matchId
				? await app.database.comments.getForMatch(this.matchId, this.#page, this.perPage)
				: this.commentId
					? await app.database.comments.getReplies(this.commentId, this.#page, this.perPage)
					: null;

			if (!result) {
				this.items = [];
				this.totalItems = 0;
				this.totalPages = 1;
				return;
			}

			this.items = append ? [...this.items, ...result.items] : result.items;
			this.totalItems = result.totalItems;
			this.totalPages = result.totalPages;
		} catch (error) {
			console.error('[COMMENTS]: failed to load comments:', error);
		} finally {
			this.isLoading = false;
		}
	}

	/** Optimistically inserts a newly created comment at the top. */
	prepend(comment: CommentExpanded): void {
		this.items = [comment, ...this.items];
		this.totalItems += 1;
	}

	/** Replaces a comment in place (e.g. after a like/dislike toggle). */
	replace(comment: CommentExpanded): void {
		this.items = this.items.map((item) => (item.id === comment.id ? comment : item));
	}

	dispose(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
	}
}

const commentsContext = new Context<CommentsContext>('<comments />');
export const createComments = () => commentsContext.set(new CommentsContext());
export const useComments = () => commentsContext.get();
