<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { statLosses, statWins } from '@company-of-heroes/ui/variants';
	import { SplitBar } from '@company-of-heroes/ui/split-bar';
	import { getRatioColor } from '../format/player-format';

	type Props = {
		wins: number;
		losses: number;
		/** Hides the W–L numbers, keeping the bar and the percentage. */
		compact?: boolean;
		class?: string;
	};

	const { t } = useI18n();

	let { wins, losses, compact = false, class: className }: Props = $props();

	const total = $derived(wins + losses);
	const percent = $derived(total > 0 ? Math.round((wins / total) * 100) : 0);
</script>

<div
	class={cn('flex min-w-0 items-center gap-2.5', className)}
	aria-label={t('{wins} wins, {losses} losses', { wins, losses })}
>
	{#if !compact}
		<span class="w-16 shrink-0 text-right text-sm tabular-nums">
			<span class={statWins}>{wins}</span><span class="text-secondary-600">–</span><span
				class={statLosses}>{losses}</span
			>
		</span>
	{/if}
	<SplitBar value={percent} leftClass="bg-green-400/55" class="min-w-10" />
	<span
		class="w-9 shrink-0 text-right text-sm font-semibold tabular-nums"
		style:color={getRatioColor(wins, losses)}
	>
		{percent}%
	</span>
</div>
