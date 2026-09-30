<script lang="ts">
	import {
		formatStreak,
		statLosses,
		statStreakClass,
		statWins
	} from '@company-of-heroes/ui/variants';
	import { cn } from '@company-of-heroes/ui/cn';
	import { formatRatio, getRatioColor } from '../format/player-format';

	type Props = {
		type: 'wins' | 'losses' | 'streak' | 'ratio';
		wins: number;
		losses: number;
		streak: number;
	};

	let { type, wins, losses, streak }: Props = $props();
</script>

{#if type === 'wins'}
	<span class={cn('font-medium', statWins)}>{wins}</span>
{:else if type === 'losses'}
	<span class={cn('font-medium', statLosses)}>{losses}</span>
{:else if type === 'streak'}
	<span class={cn('font-medium', statStreakClass(streak))}>{formatStreak(streak)}</span>
{:else}
	<span class="font-medium tabular-nums" style:color={getRatioColor(wins, losses)}>
		{formatRatio(wins, losses)}
	</span>
{/if}
