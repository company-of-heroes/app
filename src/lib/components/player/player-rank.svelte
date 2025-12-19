<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { getRankImage } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats } = usePlayer();
</script>

{#if playerResult && stats}
	<img
		src={await getRankImage(playerResult.race_id, stats.ranklevel)}
		alt="Rank"
		class="h-6 w-6"
		{...restProps}
	/>
{/if}
