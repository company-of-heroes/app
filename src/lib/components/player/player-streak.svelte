<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats } = $derived(usePlayer());

	let isPositive = $derived(
		(playerResult && playerResult?.streak > 0) || (stats && stats?.streak > 0)
	);
	let isNegative = $derived(
		(playerResult && playerResult?.streak < 0) || (stats && stats?.streak < 0)
	);
</script>

<span
	class={cn('text-center', isPositive && 'text-green-300', isNegative && 'text-red-300')}
	{...restProps}
>
	{#if playerResult}
		{#if isPositive}
			+
		{/if}
		{playerResult.streak}
	{:else if stats}
		{#if isPositive}
			+
		{/if}
		{stats.streak}
	{:else}
		-
	{/if}
</span>
