<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement>;

	let { children, ...restProps }: Props = $props();
</script>

<span {...restProps} class={cn('text-secondary-400', restProps.class)}>
	{@render children?.()}
</span>
