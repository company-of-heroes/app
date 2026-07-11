<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { surfacePanel } from '../variants';

	type Props = {
		children: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { children, ...restProps }: Props = $props();
</script>

<div {...restProps} class={cn(surfacePanel, 'border-2 p-4', restProps.class)}>
	{@render children()}
</div>
