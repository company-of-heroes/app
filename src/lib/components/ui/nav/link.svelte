<script lang="ts">
	import type { LinkProps } from '.';
	import { cn } from '$lib/utils';
	import { app } from '$core/app';
	import { page } from '$app/state';

	let { path, component, children, ...restProps }: LinkProps = $props();

	console.log(restProps.href, page.url);
</script>

<a
	{...restProps}
	class={cn(
		'text-secondary-200 px-4 py-3 font-bold transition-all',
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
