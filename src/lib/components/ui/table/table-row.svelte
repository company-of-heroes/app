<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		href?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let { children, href, ...restProps }: Props = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	{...restProps}
	class={cn(
		'flex h-11 w-full items-center *:px-4',
		'odd:bg-secondary-600/5',
		href && 'hover:text-primary cursor-pointer transition-colors',
		restProps.class
	)}
>
	{@render children?.()}
</svelte:element>
