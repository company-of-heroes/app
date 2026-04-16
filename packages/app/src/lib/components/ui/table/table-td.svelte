<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		width?:
			| '1/24'
			| '2/24'
			| '3/24'
			| '4/24'
			| '5/24'
			| '6/24'
			| '7/24'
			| '8/24'
			| '9/24'
			| '10/24'
			| '11/24'
			| '12/24'
			| '13/24'
			| '14/24'
			| '15/24'
			| '16/24'
			| '17/24'
			| '18/24'
			| '19/24'
			| '20/24'
			| '21/24'
			| '22/24'
			| '23/24'
			| '24/24';
	} & HTMLAttributes<HTMLSpanElement> & {
			href?: string;
		};

	let { width, children, href, ...restProps }: Props = $props();
</script>

{#if href}
	<a
		{href}
		{...restProps}
		class={cn(
			`min-w-${width} max-w-${width} hover:text-primary transition-colors`,
			restProps.class
		)}
	>
		{@render children?.()}
	</a>
{:else}
	<span {...restProps} class={cn(`min-w-${width} max-w-${width}`, restProps.class)}>
		{@render children?.()}
	</span>
{/if}
