<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { Button, type ButtonProps } from '../ui/button';
	import { cn } from '$lib/utils';

	type Props = Omit<ButtonProps, 'children'>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
</script>

<Button
	{...restProps}
	variant="ghost"
	class={cn(
		'text-secondary-400 font-medium',
		comment.current?.isReplying && 'text-red-500',
		restProps.class
	)}
	onclick={() => {
		comment.toggleReplying();
	}}
>
	{#if comment.current?.isReplying}
		Cancel
	{:else}
		Reply
	{/if}
</Button>
