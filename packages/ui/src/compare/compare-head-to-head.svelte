<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { getRatioColor, winrate } from '../format/player-format';
	import HeadToHeadBreakdown from '../head-to-head/head-to-head-breakdown.svelte';
	import { useCompare } from './context';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const context = useCompare();

	const record = $derived(context.compare.headToHead);
	const alias = $derived(context.compare.them.alias);
</script>

{#if !context.compare.isSelf}
	<section class={cn('border-secondary-800 border-b', className)}>
		{#if record.matchCount === 0}
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
				<span class="font-semibold text-white">{t('Head to head')}</span>
				<span class="text-secondary-400 text-sm">
					{t('No games against {alias} yet.', { alias })}
				</span>
			</div>
		{:else}
			<div
				class="border-secondary-800 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3"
			>
				<span class="font-semibold text-white">{t('Head to head')}</span>
				<span
					class="font-semibold tabular-nums"
					style:color={getRatioColor(record.wins, record.losses)}
				>
					{record.wins}–{record.losses}
				</span>
				<span class="text-secondary-400 text-sm tabular-nums">
					{t('{count} games', { count: record.matchCount })}
				</span>
				<span
					class="text-sm font-medium tabular-nums"
					style:color={getRatioColor(record.wins, record.losses)}
				>
					{winrate(record.wins, record.losses)}
				</span>
			</div>
			<HeadToHeadBreakdown {record} expandable />
		{/if}
	</section>
{/if}
