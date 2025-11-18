<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { app } from '$core/app';
	import { page } from '$app/state';

	let { path, component, children, ...restProps }: LinkProps = $props();
</script>

<a
	{...restProps}
	class={cn(
		'flex items-center gap-3',
		'px-4 py-3 font-bold transition-all',
		'hover:text-secondary-400',
		app.route?.href === restProps.href && 'text-primary',
		restProps.href &&
			restProps.href !== '/' &&
			page.url.pathname.startsWith(restProps.href) &&
			'text-primary',
		restProps.class
	)}
>
	{@render children()}
</a>
