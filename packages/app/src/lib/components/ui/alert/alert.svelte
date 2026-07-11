<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { semanticVariant, type SemanticVariant } from '../variants';

	type Props = {
		variant?: SemanticVariant;
		size?: 'sm' | 'md' | 'lg';
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { variant = 'default', size = 'md', children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn(
		'rounded-md border px-4 py-2',
		semanticVariant(variant),
		size === 'sm' && 'px-4 py-2 text-sm',
		size === 'md' && 'px-5 py-3 text-base',
		size === 'lg' && 'px-7 py-4 text-lg',
		restProps.class
	)}
>
	{@render children?.()}
</div>
