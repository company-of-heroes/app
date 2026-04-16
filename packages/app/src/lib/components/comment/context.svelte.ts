import type { CommentExpanded } from '$core/app/database/comments';
import { Context } from 'runed';

export class CommentContext {
	current = $state.raw<CommentExpanded>();

	setComment(value: CommentExpanded) {
		this.current = value;
	}

	toggleReplying() {
		if (!this.current) {
			return;
		}

		this.current.isReplying = !this.current.isReplying;
	}
}

const commentContext = new Context<CommentContext>('<comment />');
export const createComment = () => commentContext.set(new CommentContext());
export const useComment = () => commentContext.get();
