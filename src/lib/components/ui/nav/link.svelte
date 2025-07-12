<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { app } from '$lib/state/app.svelte';

	let { component, children, ...restProps }: LinkProps = $props();
</script>

<a
	{...restProps}
	class={cn(
		'bg-secondary-700 px-4 py-3 font-bold text-white transition-all',
		restProps.href === app.currentRoute?.href && 'bg-primary text-black',
		restProps.class
	)}
>
	{@render children()}
</a>
