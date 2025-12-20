<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	let { children, ...restProps }: Props = $props();
</script>

<small {...restProps} class={cn('-mt-2 text-gray-300', restProps.class)}>
	{@render children()}
</small>
