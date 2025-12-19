<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement>;

	let { children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn(
		'flex h-11 items-center text-left font-semibold',
		'text-secondary-300 bg-gray-800/70',
		'*:px-4',
		restProps.class
	)}
>
	{@render children?.()}
</div>
