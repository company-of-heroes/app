<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { cn } from '$lib/utils';

	let { ...restProps }: HTMLAttributes<HTMLSpanElement> = $props();
	let comment = useComment();
</script>

{#if comment.current}
	<span {...restProps} class={cn('text-secondary-300', restProps.class)}>
		{#if comment.current.dislikes.length > 0}
			-
		{/if}
		<span>{comment.current.dislikes.length}</span>
	</span>
{/if}
