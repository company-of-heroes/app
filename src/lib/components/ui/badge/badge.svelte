<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
	} & HTMLAttributes<HTMLSpanElement>;

	const { variant = 'primary', children, ...restProps }: Props = $props();
</script>

<span
	class={cn(
		'bg-secondary-800/40 border-secondary-600 text-secondary-200 border',
		'inline-block w-fit rounded-lg px-3 py-1 text-xs font-medium',
		variant === 'primary' && 'border-primary-500 bg-primary-blue-500/5 text-primary-200',
		variant === 'success' && 'border-green-500 bg-green-500/5 text-green-200',
		variant === 'warning' && 'border-yellow-500 bg-yellow-500/5 text-yellow-200',
		variant === 'destructive' && 'border-red-500 bg-red-500/5 text-red-200'
	)}
>
	{@render children?.()}
</span>
