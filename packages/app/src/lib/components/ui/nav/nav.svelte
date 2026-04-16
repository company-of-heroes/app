<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLElement>;

	let { children, ...restProps }: Props = $props();
</script>

<nav {...restProps} class={cn('flex flex-col', restProps.class)}>
	{@render children?.()}
</nav>
