<script lang="ts">
	import { getRatioColor, winrate } from '../format/player-format';

	type Props = {
		/** Left out or without games: shows `—`. */
		record: { wins: number; losses: number } | undefined;
	};

	let { record }: Props = $props();

	const games = $derived(record ? record.wins + record.losses : 0);
</script>

<!-- Win rate and games of one side of a mirrored row. -->
<div class="flex min-w-0 items-baseline justify-center gap-1.5 tabular-nums">
	{#if !record || games === 0}
		<span class="text-secondary-500">—</span>
	{:else}
		<span class="font-medium" style:color={getRatioColor(record.wins, record.losses)}>
			{winrate(record.wins, record.losses)}
		</span>
		<span class="text-secondary-400 text-xs">({games})</span>
	{/if}
</div>
