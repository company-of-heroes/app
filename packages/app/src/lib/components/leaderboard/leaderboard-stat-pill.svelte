<script lang="ts">
	import { getRatioColor, getStreakColor, formatRatio } from './leaderboard-utils';

	type Props = {
		type: 'wins' | 'losses' | 'streak' | 'ratio';
		wins: number;
		losses: number;
		streak: number;
	};

	let { type, wins, losses, streak }: Props = $props();
</script>

{#if type === 'wins'}
	<span class="text-success font-medium tabular-nums">{wins}</span>
{:else if type === 'losses'}
	<span class="text-destructive/90 font-medium tabular-nums">{losses}</span>
{:else if type === 'streak'}
	<span class="font-medium tabular-nums" style:color={getStreakColor(streak)}>
		{streak >= 0 ? '+' : ''}{streak}
	</span>
{:else}
	<span class="font-medium tabular-nums" style:color={getRatioColor(wins, losses)}>
		{formatRatio(wins, losses)}
	</span>
{/if}
