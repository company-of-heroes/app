<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { player, stats } = $derived(usePlayer());
</script>

<span {...restProps} class={cn('text-center', restProps.class)}>
	{stats?.rank ?? 'N/A'}
</span>
