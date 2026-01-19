<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn, getRankImage } from '$lib/utils';
	import { isNumber } from 'lodash-es';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats, race, player } = $derived(usePlayer());
</script>

{#if playerResult && stats}
	{#await getRankImage(playerResult.race_id, stats.ranklevel) then src}
		<img {src} alt="Rank" {...restProps} class={cn('h-6 w-6', restProps.class)} />
	{/await}
{:else if stats && isNumber(race)}
	{#await getRankImage(race, stats.ranklevel) then src}
		<img {src} alt="Rank" {...restProps} class={cn('h-6 w-6', restProps.class)} />
	{/await}
{/if}
