<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { cn } from '$lib/utils';

	let { ...restProps }: HTMLAttributes<HTMLSpanElement> = $props();
	let comment = useComment();
</script>

{#if comment.current}
	<span {...restProps} class={cn('text-secondary-300', restProps.class)}>
		<span>{comment.current.likes.length - comment.current.dislikes.length}</span>
	</span>
{/if}
