<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
		size?: 'sm' | 'md' | 'lg';
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { variant = 'default', size = 'md', children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn(
		'rounded-md border px-4 py-2',
		variant === 'destructive' && 'border-red-700 bg-red-700/10 text-red-500',
		variant === 'warning' && 'border-yellow-700 bg-yellow-700/10 text-yellow-500',
		variant === 'success' && 'border-green-700 bg-green-700/10 text-green-200',
		variant === 'info' && 'border-blue-700 bg-blue-700/10 text-blue-200',
		variant === 'default' && 'border-gray-700 bg-gray-700/10 text-gray-200',
		size === 'sm' && 'px-4 py-2 text-sm',
		size === 'md' && 'px-5 py-3 text-base',
		size === 'lg' && 'px-7 py-4 text-lg',
		restProps.class
	)}
>
	{@render children?.()}
</div>
