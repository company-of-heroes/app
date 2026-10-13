<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { getRatioColor, winrate } from '../format/player-format';
	import { Skeleton } from '../ui/skeleton';
	import HeadToHeadBreakdown from './head-to-head-breakdown.svelte';
	import type { HeadToHead } from './types';

	type Props = {
		record: HeadToHead | null;
		alias: string;
		loading?: boolean;
		error?: boolean;
	};

	let { record, alias, loading = false, error = false }: Props = $props();
	const { t } = useI18n();
</script>

{#if loading}
	<div class="border-secondary-800 flex items-baseline gap-3 border-b px-4 py-3">
		<Skeleton class="h-5 w-40" />
		<Skeleton class="h-4 w-16" />
	</div>
	<div class="-mb-px">
		{#each [1, 2, 3, 4] as row (row)}
			<div class="border-secondary-800 flex h-9 items-center gap-3 border-b px-4">
				<Skeleton class="h-3.5 w-32" />
				<Skeleton class="ml-auto h-3.5 w-24" />
			</div>
		{/each}
	</div>
{:else if error}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('Could not load head to head.')}</p>
{:else if !record || record.matchCount === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">
		{t('No games against {alias} yet.', { alias })}
	</p>
{:else}
	<div
		class="border-secondary-800 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3"
	>
		<span class="font-semibold text-white">
			{t('{wins}–{losses} against {alias}', {
				wins: record.wins,
				losses: record.losses,
				alias
			})}
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
