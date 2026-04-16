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
		variant === 'primary' && 'border-primary bg-primary/5 text-primary',
		variant === 'success' && 'border-success bg-success/5 text-success',
		variant === 'warning' && 'border-warning bg-warning/5 text-warning',
		variant === 'destructive' && 'border-destructive bg-destructive/5 text-destructive'
	)}
>
	{@render children?.()}
</span>
