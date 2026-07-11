<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn, getRankImage, Race } from '$lib/utils';
	import { isNumber } from 'lodash-es';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats, race } = $derived(usePlayer());
	const src = $derived.by(() => {
		if (playerResult && stats) {
			return getRankImage(playerResult.race_id, stats.ranklevel);
		}

		if (isNumber(race)) {
			return getRankImage(race, stats?.ranklevel ?? -1);
		}

		return getRankImage(Race.US, -1);
	});
</script>

{#if src}
	<img {src} alt="Rank" {...restProps} class={cn('h-6 w-6', restProps.class)} />
{/if}
