<script lang="ts">
	import type { CommentExpanded } from '$core/app/database/comments';
	import type { HTMLAttributes } from 'svelte/elements';
	import { createComment } from './context.svelte';

	type Props = {
		comment: CommentExpanded;
	} & HTMLAttributes<HTMLDivElement>;

	let { children, comment, ...restProps }: Props = $props();
	let context = createComment();

	$effect(() => {
		context.setComment(comment);
	});
</script>

<div {...restProps}>
	{@render children?.()}
</div>
