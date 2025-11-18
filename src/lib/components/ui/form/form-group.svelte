<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { children, ...restProps }: Props = $props();
</script>

<div {...restProps} class={cn('mb-4 flex w-full flex-col gap-2', restProps.class)}>
	{@render children?.()}
</div>
