<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { app } from '$core/app';

	let { path, component, children, ...restProps }: LinkProps = $props();
</script>

<a
	{...restProps}
	class={cn(
		'text-secondary-200 px-4 py-3 font-bold transition-all',
		app.currentRoute?.href === restProps.href && 'text-primary',
		restProps.class
	)}
>
	{@render children()}
</a>
