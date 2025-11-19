<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { variant = 'default', children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn(
		'rounded-md border px-4 py-2',
		variant === 'destructive' && 'border-red-700 bg-red-700/10 text-sm text-red-500',
		variant === 'warning' && 'border-yellow-700 bg-yellow-700/10 text-sm text-yellow-500',
		variant === 'success' && 'border-green-700 bg-green-700/10 text-sm text-green-200',
		variant === 'info' && 'border-blue-700 bg-blue-700/10 text-sm text-blue-200',
		variant === 'default' && 'border-gray-700 bg-gray-700/10 text-sm text-gray-200',
		restProps.class
	)}
>
	{@render children?.()}
</div>
