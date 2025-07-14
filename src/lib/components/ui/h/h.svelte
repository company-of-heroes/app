<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HeadingProps } from '.';

	let { level, children, ...restProps }: HeadingProps = $props();
</script>

<svelte:element
	this={`h${level}`}
	{...restProps}
	class={cn(
		'font-heading font-[800]',
		level == 1 && 'mb-6 text-4xl',
		level == 2 && 'text-3xl',
		level == 3 && 'text-2xl',
		level == 4 && 'text-xl',
		level == 5 && 'text-base',
		level == 6 && 'text-sm',
		restProps.class
	)}
>
	{@render children()}
</svelte:element>
