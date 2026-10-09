<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import * as Statistics from '@company-of-heroes/ui/statistics';
	import { DateRangePopover } from '@company-of-heroes/ui/date-range-popover';
	import { formatDate } from '@company-of-heroes/ui/format/date';
	import { normalizeMapName } from '@company-of-heroes/ui/format/player-format';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { ToggleGroup } from '@company-of-heroes/ui/toggle-group';
	import { flushHeader, flushHeaderTitle, interactive } from '@company-of-heroes/ui/variants';
	import { currentLocale, href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import { cn } from '$lib/utils/cn';
	import type { StatisticsByMode } from '@company-of-heroes/ui/statistics/types';
	import type { Snippet } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const custom = $derived('from' in data.range ? data.range : null);
	const modes = $derived(
		Statistics.STATISTICS_MODES.map((mode) => ({
			value: mode,
			label: t(Statistics.STATISTICS_MODE_LABELS[mode])
		}))
	);
	const activePeriod = $derived('period' in data.range ? data.range.period : null);
	// "Custom" opens a calendar; once a range is picked it shows that range.
	const periods = $derived([
		{ value: 'all', label: t('All time') },
		{ value: '365', label: t('Last year') },
		{ value: '90', label: t('90 days') },
		{ value: '30', label: t('30 days') },
		{ value: '7', label: t('7 days') },
		{
			value: 'custom',
			label: custom
				? `${formatDate(custom.from, currentLocale())} – ${formatDate(custom.to, currentLocale())}`
				: t('Custom')
		}
	]);
	let period = $derived(activePeriod ?? 'custom');
	let calendarOpen = $state(false);
	const rangeQuery = $derived(
		custom ? `from=${custom.from}&to=${custom.to}` : `period=${activePeriod}`
	);
	const mapQuery = $derived(data.map ? `&map=${encodeURIComponent(data.map)}` : '');
	/** Picking a map keeps the current page (dimmed) until its numbers arrive. */
	const mapOnly = $derived.by(() => {
		const to = navigating.to?.url.searchParams;
		const from = page.url.searchParams;
		return !!to && ['mode', 'period', 'from', 'to'].every((key) => to.get(key) === from.get(key));
	});
	const switching = $derived(
		unlocalizedPath(navigating.to?.url.pathname ?? '').startsWith('/stats') && !mapOnly
	);
	// The last statistics shown for this range, kept while a map filter loads.
	let previous = $state.raw<{ range: string; byMode: StatisticsByMode } | null>(null);

	$effect(() => {
		const range = rangeQuery;
		let current = true;
		data.statistics.then(
			(byMode) => {
				if (current) {
					previous = { range, byMode };
				}
			},
			() => {}
		);
		return () => {
			current = false;
		};
	});

	function statisticsHref(mode: string, query: string) {
		return href(`/stats?mode=${mode}&${query}${mapQuery}`);
	}

	/** Filters on `map`, or shows every map again when it is the selected one. */
	function mapHref(map: string) {
		const filter = map === data.map ? '' : `&map=${encodeURIComponent(map)}`;
		return href(`/stats?mode=${data.mode}&${rangeQuery}${filter}`);
	}

	function navigate(url: string) {
		void goto(url, { noScroll: true, keepFocus: true });
	}

	/** A preset navigates; "Custom" (also clicked again while selected) opens the calendar. */
	function pickPeriod(value: string) {
		if (value === 'custom' || (value === '' && activePeriod === null)) {
			calendarOpen = true;
			return;
		}

		if (value !== '') {
			navigate(statisticsHref(data.mode, `period=${value}`));
		}
	}

	function pickRange(from: string, to: string) {
		navigate(statisticsHref(data.mode, `from=${from}&to=${to}`));
	}
</script>

{#snippet panel(title: string, body: Snippet, note?: string)}
	<section>
		<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
			<h2 class={flushHeaderTitle}>{title}</h2>
			{#if note}
				<p class="text-secondary-500 text-xs">{note}</p>
			{/if}
		</div>
		{@render body()}
	</section>
{/snippet}

<svelte:head>
	<title>{t('Stats')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Which maps are played and which factions win in Company of Heroes, from community automatch, Basic Matches and skirmishes.'
		)}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/stats')}" />
	<meta property="og:title" content={t('CoH Statistics')} />
</svelte:head>

<div class="border-secondary-800 border-b px-4 py-6">
	<h1 class="font-heading text-3xl font-bold text-white">{t('Stats')}</h1>
	<p class="text-secondary-400 mt-2 max-w-3xl text-sm leading-relaxed">
		{t(
			'Which maps are played and which factions win, from the matches companion users stored: ranked automatch, Basic Matches and skirmishes. Arranged-team ladders count with their team size; skirmishes only count the human players.'
		)}
	</p>
	<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
		<ToggleGroup
			value={data.mode}
			items={modes}
			onValueChange={(mode) => navigate(statisticsHref(mode, rangeQuery))}
			aria-label={t('Mode')}
			variant="tabs"
		/>
		<div data-period-toggle class="max-w-full">
			<ToggleGroup
				bind:value={period}
				items={periods}
				onValueChange={pickPeriod}
				aria-label={t('Period')}
				class="max-w-full overflow-x-auto"
			/>
		</div>
		<DateRangePopover
			bind:open={calendarOpen}
			anchor={'[data-period-toggle] [data-value="custom"]'}
			from={custom?.from}
			to={custom?.to}
			onChange={pickRange}
			onOpenChange={(open) => {
				if (!open) {
					period = activePeriod ?? 'custom';
				}
			}}
		/>
	</div>
</div>

{#snippet loading()}
	<div aria-busy="true">
		<div class="border-secondary-800 flex h-11 items-center border-b px-4">
			<Skeleton class="h-3.5 w-64" />
		</div>
		<div
			class="divide-secondary-800 grid divide-y lg:grid-cols-[minmax(0,1fr)_28rem] lg:divide-x lg:divide-y-0"
		>
			{#snippet maps()}
				<Statistics.Skeleton part="maps" rows={6} />
			{/snippet}
			{#snippet factions()}
				<Statistics.Skeleton part="factions" />
			{/snippet}
			{#snippet matchups()}
				<Statistics.Skeleton part="matchups" />
			{/snippet}
			{#snippet facts()}
				<Statistics.Skeleton part="facts" rows={4} />
			{/snippet}
			{@render panel(t('Maps'), maps)}
			<div class="divide-secondary-800 divide-y">
				{@render panel(t('Factions'), factions)}
				{@render panel(t('Matchups'), matchups)}
				{@render panel(t('Did you know?'), facts)}
			</div>
		</div>
		{#snippet doctrines()}
			<Statistics.Skeleton part="columns" rows={3} />
		{/snippet}
		{#snippet units()}
			<Statistics.Skeleton part="columns" rows={5} />
		{/snippet}
		<div class="border-secondary-800 divide-secondary-800 divide-y border-t">
			{@render panel(t('Doctrines'), doctrines)}
			{@render panel(t('Most built units'), units)}
		</div>
	</div>
{/snippet}

{#snippet content(byMode: StatisticsByMode, stale = false)}
	{@const stats = byMode[data.mode]}
	<!-- The server leaves a mode unfiltered when the map was not played in it. -->
	{@const selected = stats.maps.some((row) => row.map === data.map) ? data.map : null}
	{@const replayNote = t('From {count} analysed replays', {
		count: stats.replayMatches.toLocaleString(currentLocale())
	})}
	<div aria-busy={stale} class={cn('transition-opacity', stale && 'opacity-60')}>
		<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
			<span class="font-bold text-white">{t(Statistics.STATISTICS_MODE_LABELS[data.mode])}</span>
			{#if selected}
				· <span class="font-bold text-white">{normalizeMapName(selected)}</span>
				<a
					href={mapHref(selected)}
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
					class={cn(interactive, 'text-primary text-xs hover:underline')}>({t('All maps')})</a
				>
			{/if}
			· {t('{count} matches', { count: stats.matchCount.toLocaleString(currentLocale()) })}
			{#if stats.firstAt && stats.lastAt}
				· {formatDate(stats.firstAt, currentLocale())} – {formatDate(stats.lastAt, currentLocale())}
			{/if}
			{#if stats.uploadMatches > 0}
				<span class="text-secondary-500 block text-xs sm:inline sm:pl-1">
					{t('incl. {count} uploaded replays: they count for picks, not for win rates', {
						count: stats.uploadMatches.toLocaleString(currentLocale())
					})}
				</span>
			{/if}
		</p>
		{#if stats.matchCount === 0}
			<p class="text-secondary-400 px-4 py-6 text-sm">
				{t('No matches in this period yet.')}
			</p>
		{:else}
			{#snippet maps()}
				<!-- Keeps the last row's border when the column is shorter than its neighbour; -mb-px lays it over the next border when it does reach the bottom. -->
				<Statistics.Maps collapsed={10} {mapHref} class="-mb-px" />
			{/snippet}
			{#snippet factions()}
				<Statistics.Factions />
			{/snippet}
			{#snippet matchups()}
				<Statistics.Matchups />
			{/snippet}
			{#snippet facts()}
				<Statistics.Facts />
			{/snippet}
			<Statistics.Root statistics={stats} {selected}>
				<div
					class="divide-secondary-800 grid divide-y lg:grid-cols-[minmax(0,1fr)_28rem] lg:divide-x lg:divide-y-0"
				>
					{@render panel(t('Maps'), maps)}
					<div class="divide-secondary-800 divide-y">
						{@render panel(t('Factions'), factions)}
						{@render panel(t('Matchups'), matchups)}
						{@render panel(t('Did you know?'), facts)}
					</div>
				</div>
				<div class="border-secondary-800 divide-secondary-800 divide-y border-t">
					{#if stats.replayMatches === 0}
						<p class="text-secondary-400 px-4 py-6 text-sm">
							{t('No analysed replays in this period yet, so no doctrines or units to show.')}
						</p>
					{:else}
						{#snippet doctrines()}
							<Statistics.Doctrines />
						{/snippet}
						{#snippet units()}
							<Statistics.Blueprints kind="units" />
						{/snippet}
						{#snippet openings()}
							<Statistics.Blueprints kind="openings" />
						{/snippet}
						{#snippet upgrades()}
							<Statistics.Blueprints kind="upgrades" />
						{/snippet}
						{@render panel(t('Doctrines'), doctrines, replayNote)}
						{@render panel(t('Most built units'), units, t('Builders not counted'))}
						{@render panel(t('Openings'), openings, t('First unit after the builders'))}
						{@render panel(t('Popular upgrades'), upgrades)}
					{/if}
				</div>
			</Statistics.Root>
		{/if}
	</div>
{/snippet}

{#if switching}
	{@render loading()}
{:else}
	{#await data.statistics}
		{#if previous && previous.range === rangeQuery}
			{@render content(previous.byMode, true)}
		{:else}
			{@render loading()}
		{/if}
	{:then byMode}
		{@render content(byMode)}
	{/await}
{/if}
