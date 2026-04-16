<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {} & HTMLAttributes<HTMLSpanElement>;

	let { children, ...restProps }: Props = $props();
</script>

<span class={cn('grid grid-cols-[auto_1fr] gap-x-8 gap-y-1', restProps.class)}>
	{@render children?.()}
</span>
