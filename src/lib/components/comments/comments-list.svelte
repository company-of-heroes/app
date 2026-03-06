<script lang="ts">
	import * as Comment from '$lib/components/comment';
	import { Editor } from '$lib/components/ui/editor';
	import { Button } from '../ui/button';
	import { useComments } from './context.svelte';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DotIcon from 'phosphor-svelte/lib/DotIcon';
	import { cn } from '$lib/utils';
	import { isObject } from 'lodash-es';
	import { app } from '$core/app/context';

	const comments = useComments();
</script>

{#each comments.items as comment, _ (comment.id)}
	{@const isReply = isObject(comment.parent)}
	{@const hasReplies = comment.commentsViaParent?.length > 0}

	<Comment.Root
		{comment}
		class={cn(
			isReply && 'border-secondary-800 border-b bg-gray-900/80',
			!isReply && 'border-secondary-800 mt-4 overflow-clip rounded-lg border bg-gray-600/30'
		)}
	>
		<Comment.User.Root
			user={comment.sender}
			class="border-secondary-800 grid grid-cols-[35px_auto] gap-4 border-b p-4"
		>
			<Comment.User.Avatar />
			<div class="flex items-center gap-3">
				<Comment.User.Name class="text-lg" />
				<span class="bg-secondary-600 size-1 rounded-full"></span>
				<Comment.Date class="text-secondary-400 text-sm" />
			</div>
		</Comment.User.Root>
		<Comment.Text class="text-secondary-300 p-4" />
		<div class="flex items-center gap-4 px-4 pb-4">
			<div class="flex items-center gap-2">
				<Comment.Like />
				<Comment.LikesCount class="text-green-300" />
			</div>
			<div class="flex items-center gap-2">
				<Comment.DislikesCount class="text-red-300" />
				<Comment.Dislike />
			</div>
			<div>
				<Comment.Reply />
			</div>
		</div>
		{#if comment.isReplying}
			<Editor
				class="rounded-none border-0"
				onsubmit={(v) => {
					app.database.comments
						.createReply(comment.parent?.id || comment.id, v, [
							comment.parent?.sender?.id || comment.sender.id,
							...comment.mentions.map((m) => m.id)
						])
						.then(() => {
							comment.isReplying = false;
						});
				}}
			/>
		{/if}
		{#if hasReplies}
			<Comment.Replies class="border-secondary-800 border-t" />
		{/if}
	</Comment.Root>
{/each}
