<script lang="ts">
	import type { CommentsRootProps } from '../comments';
	import * as Comments from '$lib/components/comments';
	import { useComment } from './context.svelte';
	import { CommentsContext } from '../comments/context.svelte';

	let { ...restProps }: CommentsRootProps = $props();

	let comment = useComment();
	let context = $state<CommentsContext>();
</script>

<Comments.Root {...restProps} commentId={comment.current?.id} bind:context>
	{#if context?.totalItems}
		<Comments.List />
	{/if}
</Comments.Root>
