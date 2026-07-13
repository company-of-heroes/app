<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { stats } = $derived(usePlayer());
	const position = $derived(
		stats?.rank != null && stats.rank > 0 ? stats.rank : -1
	);
</script>

<span {...restProps} class={cn('text-center', restProps.class)}>
	{position}
</span>
