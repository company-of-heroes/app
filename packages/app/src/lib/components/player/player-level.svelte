<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { stats } = $derived(usePlayer());
	const ranklevel = $derived(
		stats?.ranklevel ? (stats.ranklevel > 0 ? stats.ranklevel : undefined) : undefined
	);
</script>

<span {...restProps} class={cn('text-center', restProps.class)}>
	{ranklevel ?? '-'}
</span>
