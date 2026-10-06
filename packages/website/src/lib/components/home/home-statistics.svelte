<script lang="ts" module>
	import type { StatisticsByMode, StatisticsHeadline } from '@company-of-heroes/ui/statistics';

	export type HomeStatisticsData = {
		stats: StatisticsByMode;
		headline: StatisticsHeadline;
	};
</script>

<script lang="ts">
	import * as Statistics from '@company-of-heroes/ui/statistics';
	import { Button } from '@company-of-heroes/ui/button';
	import { ToggleGroup } from '@company-of-heroes/ui/toggle-group';
	import { href, useI18n } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	type Props = {
		statistics: HomeStatisticsData | null;
		loading?: boolean;
	};

	let { statistics, loading = false }: Props = $props();
	const { t } = useI18n();

	let mode = $state<string>('1v1');
	const modes = $derived(
		Statistics.STATISTICS_MODES.map((value) => ({
			value,
			label: t(Statistics.STATISTICS_MODE_LABELS[value])
		}))
	);
	const stats = $derived(statistics?.stats[mode as Statistics.StatisticsMode] ?? null);
</script>

{#snippet modeBar(disabled: boolean)}
	<div class="border-secondary-800 border-b px-4 py-2">
		<ToggleGroup bind:value={mode} items={modes} {disabled} aria-label={t('Mode')} variant="tabs" />
	</div>
{/snippet}

{#snippet grid(maps: Snippet, side: Snippet)}
	<div
		class="divide-secondary-800 grid divide-y lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:divide-x lg:divide-y-0"
	>
		{@render maps()}
		<div class="divide-secondary-800 divide-y">
			{@render side()}
		</div>
	</div>
{/snippet}

{#if loading || statistics}
	<section class="border-secondary-800 border-b">
		<div
			class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
		>
			<div>
				<h2 class="font-heading text-xl font-bold text-white">{t('Community statistics')}</h2>
				<p class="text-secondary-400 mt-1 text-sm">{t('Community matches · last 30 days')}</p>
			</div>
			<Button href={href('/stats')} variant="link" size="sm" class="px-0">
				{t('All statistics')}
			</Button>
		</div>
		{#if loading || !statistics || !stats}
			{#snippet maps()}
				<Statistics.Skeleton part="maps" rows={5} />
			{/snippet}
			{#snippet side()}
				<Statistics.Skeleton part="factions" compact />
				<Statistics.Skeleton part="facts" rows={4} />
			{/snippet}
			<div aria-busy="true">
				<Statistics.Skeleton part="keyNumbers" class="border-secondary-800 border-b" />
				{@render modeBar(true)}
				{@render grid(maps, side)}
			</div>
		{:else}
			{#snippet maps()}
				<Statistics.Maps maps={stats.maps} matchCount={stats.matchCount} limit={5} />
			{/snippet}
			{#snippet side()}
				<Statistics.Factions factions={stats.factions} compact />
				<Statistics.Facts statistics={stats} limit={4} />
			{/snippet}
			<Statistics.KeyNumbers headline={statistics.headline} class="border-secondary-800 border-b" />
			{@render modeBar(false)}
			{#if stats.matchCount === 0}
				<p class="text-secondary-400 px-4 py-6 text-sm">
					{t('No matches in this period yet.')}
				</p>
			{:else}
				{@render grid(maps, side)}
			{/if}
		{/if}
	</section>
{/if}
