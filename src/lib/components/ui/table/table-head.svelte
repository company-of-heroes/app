<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement>;

	let { children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn(
		'flex h-12 items-center gap-4 px-4 text-left font-semibold',
		'text-secondary-300 bg-gray-800/70',
		restProps.class
	)}
>
	{@render children?.()}
</div>
