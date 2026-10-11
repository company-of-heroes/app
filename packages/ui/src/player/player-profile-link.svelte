<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn } from '@company-of-heroes/ui/cn';

	type Props = {
		href: string;
		class?: string;
		children: Snippet;
	} & Omit<HTMLAnchorAttributes, 'href' | 'children' | 'class'>;

	let { href, class: className, children, ...restProps }: Props = $props();
</script>

<a {href} class={cn(className)} {...restProps}>
	{@render children()}
</a>
