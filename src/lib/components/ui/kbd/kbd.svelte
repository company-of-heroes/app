<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		children: Snippet;
		class?: string;
	} & HTMLAttributes<HTMLButtonElement>;

	let { children, ...restProps }: Props = $props();
</script>

<button
	class={cn(
		'bg-secondary-950/30 text-secondary-200 rounded-md px-4 py-2.5 text-sm uppercase',
		'border border-gray-600',
		restProps.class
	)}
	{...restProps}
>
	{@render children()}
</button>
