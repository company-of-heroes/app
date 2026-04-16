<script lang="ts">
	import * as Comment from '$lib/components/comment';
	import * as Comments from '$lib/components/comments';
	import { app } from '$core/app/context';
	import { Editor } from '../ui/editor';
	import { useComment } from './context.svelte';
	import { compact } from 'lodash-es';
	import { CommentsContext } from '../comments/context.svelte';
	import { cn } from '$lib/utils';

	let comment = useComment();
	let context = $state<CommentsContext>();
</script>

{#if comment.current?.isReplying}
	<Editor
		onsubmit={(value) => {
			if (!comment.current) {
				return;
			}

			app.database.comments
				.createReply(
					comment.current?.parent?.id || comment.current.id,
					value,
					compact([comment.current.sender.id, comment.current.parent?.sender?.id])
				)
				.then(() => {
					comment.toggleReplying();
				});
		}}
		class="mt-2 mb-4"
	/>
{/if}

<div class="mt-4">
	<Comments.Root commentId={comment.current?.id} bind:context>
		{#if context?.totalItems}
			<button
				class="group absolute top-[46px] left-0 h-[calc(100%-75px)] w-[46px] cursor-pointer"
				title="Hide replies"
				type="button"
			>
				<div
					class={cn('bg-secondary-900 mx-auto h-full w-px transition-colors group-hover:bg-white')}
				></div>
			</button>
			<Comments.List />
		{/if}
	</Comments.Root>
</div>
