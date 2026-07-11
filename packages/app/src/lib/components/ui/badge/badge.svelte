<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { semanticVariant, type SemanticVariant } from '../variants';

	type Props = {
		variant?: SemanticVariant | 'primary';
	} & HTMLAttributes<HTMLSpanElement>;

	const { variant = 'primary', children, ...restProps }: Props = $props();
</script>

<span
	{...restProps}
	class={cn(
		'inline-block w-fit rounded-lg px-3 py-1 text-xs font-medium',
		variant === 'primary' && 'border-primary bg-primary/5 text-primary border',
		variant !== 'primary' && cn('border', semanticVariant(variant)),
		restProps.class
	)}
>
	{@render children?.()}
</span>
