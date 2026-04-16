<script lang="ts">
	import * as Comment from '$lib/components/comment';
	import { useComments } from './context.svelte';

	const comments = useComments();
</script>

<div class="grid">
	{#each comments.items as comment}
		<Comment.Root {comment} class="relative grid grid-cols-[46px_auto] items-start gap-4">
			<Comment.User.Root user={comment.sender}>
				<Comment.User.Avatar />
				<div class="flex flex-col">
					<div class="mt-2 flex items-center gap-2">
						<Comment.User.Name class="font-bold" />
						<Comment.Date class="text-secondary-500" />
					</div>
					<Comment.Text />
					<div class="flex items-center gap-4">
						<Comment.Likes />
						<Comment.Dislikes />
						<Comment.Reply />
					</div>
					<Comment.Replies />
				</div>
			</Comment.User.Root>
		</Comment.Root>
	{/each}
</div>
