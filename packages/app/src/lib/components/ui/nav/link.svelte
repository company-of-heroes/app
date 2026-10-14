<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { page } from '$app/state';

	let { path, component: _component, children, ...restProps }: LinkProps = $props();
	let isActive = $derived.by(() => {
		const pathname = page.url.pathname;
		if (restProps.href === '/') {
			return pathname === '/';
		}

		const prefixes = [restProps.href, path].filter((value): value is string => !!value);
		return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
	});
</script>

<a
	{...restProps}
	class={cn(
		'flex items-center gap-3',
		'px-4 py-3 font-bold transition-all',
		'text-secondary-100 hover:text-secondary-400',
		$state.eager(isActive) && 'text-primary hover:text-primary',
		restProps.class
	)}
	data-active={isActive ? 'active' : undefined}
>
	{@render children()}
</a>
