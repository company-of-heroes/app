<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { getRatioColor } from '../format/player-format';
	import { Popover } from '../ui/popover';
	import HeadToHeadBreakdown from './head-to-head-breakdown.svelte';
	import type { HeadToHead } from './types';

	type Props = {
		record: HeadToHead;
		alias?: string;
		class?: string;
	};

	let { record, alias, class: className }: Props = $props();
	const { t } = useI18n();
</script>

{#if record.matchCount > 0}
	<Popover side="bottom" contentClass="w-[22rem] max-w-[90vw] p-0">
		{#snippet trigger({ props })}
			<button
				type="button"
				{...props}
				class={cn(
					interactive,
					'inline-flex shrink-0 items-center text-[10px] font-bold tabular-nums hover:underline',
					className
				)}
				style:color={getRatioColor(record.wins, record.losses)}
				aria-label={t('Head to head: {wins} wins, {losses} losses', {
					wins: record.wins,
					losses: record.losses
				})}
			>
				{record.wins}–{record.losses}
			</button>
		{/snippet}
		<div class="border-secondary-800 flex items-baseline gap-2 border-b px-4 py-3 text-sm">
			<span class="font-semibold text-white">{t('Head to head')}</span>
			{#if alias}
				<span class="text-secondary-300 min-w-0 truncate">{alias}</span>
			{/if}
			<span class="text-secondary-400 ml-auto shrink-0 tabular-nums">
				{t('{count} games', { count: record.matchCount })}
			</span>
		</div>
		<HeadToHeadBreakdown {record} />
	</Popover>
{/if}
