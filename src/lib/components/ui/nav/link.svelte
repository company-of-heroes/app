<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { page } from '$app/state';

	let { path, component, children, ...restProps }: LinkProps = $props();
	let isActive = $derived(
		restProps.href === '/' && page.url.pathname === '/current-game'
			? true
			: restProps.href === '/'
				? page.url.pathname === '/'
				: page.url.pathname.startsWith(restProps.href ?? '')
	);
</script>

<a
	{...restProps}
	class={cn(
		'flex items-center gap-3',
		'px-4 py-3 font-bold transition-all',
		'hover:text-secondary-400',
		$state.eager(isActive) && 'text-primary hover:text-primary',
		restProps.class
	)}
	data-active={isActive ? 'active' : undefined}
>
	{@render children()}
</a>
