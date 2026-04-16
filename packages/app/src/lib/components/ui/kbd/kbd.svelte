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
		'bg-secondary-800/30 rounded-md px-4 py-2 text-sm uppercase',
		'border-secondary-800/30 border border-b-2 border-b-gray-600',
		restProps.class
	)}
	{...restProps}
>
	{@render children()}
</button>
