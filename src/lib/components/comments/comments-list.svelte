<script lang="ts">
	import * as Comment from '$lib/components/comment';
	import { Editor } from '$lib/components/ui/editor';
	import { Button } from '../ui/button';
	import { useComments } from './context.svelte';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DotIcon from 'phosphor-svelte/lib/DotIcon';
	import { cn } from '$lib/utils';

	const comments = useComments();
</script>

<div class="grid gap-4">
	{#each comments.items as comment}
		<Comment.Root {comment} class="bg-secondary-950/30 border-secondary-800 rounded-lg border">
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
		</Comment.Root>
		<!-- <Comment.Root {comment} class="relative">
			<Comment.User.Root
				user={comment.sender}
				class="grid grid-cols-[35px_auto] items-center gap-4"
			>
				{#if comments.isReply}
					<div class="bg-secondary-800 absolute -top-[calc(100%+1rem)] -left-8 h-full w-px"></div>
					<div
						class="border-secondary-800 absolute -top-4 -left-8 size-8 rounded-bl-2xl border-b border-l"
					></div>
				{/if}
				<Comment.User.Avatar class="relative z-10" />
				<div class="flex items-center gap-4">
					<Comment.User.Name class="text-lg" />
					<Comment.Date class="text-secondary-400 text-sm" />
				</div>
			</Comment.User.Root>
			<div class="mt-2 grid grid-cols-[35px_auto] gap-4">
				<Comment.Text class="text-secondary-300 col-start-2" />
			</div>
			<div class="mt-4 grid grid-cols-[35px_auto] items-center gap-4">
				{#if comment.commentsViaParent && !comment.hideReplies}
					<!-- <div class={cn('bg-secondary-900 absolute top-0 left-[17px] h-full w-px')}></div>
					<Button
						size="icon-xs"
						variant="secondary"
						class="relative z-10 place-self-center overflow-clip before:absolute before:inset-0 before:-z-1 before:bg-gray-900"
						onclick={() => (comment.hideReplies = !comment.hideReplies)}
					>
						<CaretUpIcon />
					</Button>
				{/if}
				<div class="col-start-2 flex items-center gap-4">
					<div
						class="bg-secondary-950 border-secondary-800 flex items-center gap-2 rounded-lg border-1 px-3 py-1"
					>
						<Comment.Like />
						<Comment.LikesCount />
						<Comment.Dislike />
					</div>
					<Comment.Reply size="sm" />
				</div>
			</div>
			{#if comment.isReplying}
				<div class="mt-4 grid grid-cols-[35px_auto] gap-4">
					<div class="col-start-2">
						<Editor
							onsubmit={(val) => {
								console.log(val);
							}}
						/>
					</div>
				</div>
			{/if}
			{#if comment.commentsViaParent}
				<div class="bg-secondary-800 absolute top-0 left-[17px] h-[calc(100%-10rem)] w-px"></div>
				<div class="mt-4 grid grid-cols-[35px_auto] gap-4">
					{#if comment.hideReplies}
						<Button
							variant="outline"
							size="sm"
							class="relative z-10 col-start-2 w-fit"
							onclick={() => (comment.hideReplies = !comment.hideReplies)}
						>
							Show replies
						</Button>
					{:else}
						<Comment.Replies class="col-start-2" />
					{/if}
				</div>
			{/if}
		</Comment.Root> -->
	{/each}
</div>
