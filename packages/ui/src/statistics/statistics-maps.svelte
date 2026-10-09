<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { tooltip } from '../attachments/tooltip.svelte';
	import MapImage from '../ui/map-image.svelte';
	import { Button } from '../ui/button';
	import { normalizeMapName } from '../format/player-format';
	import { formatCount, minutes, percent } from './format';
	import { mapColumns } from './layout';
	import type { StatisticsMap } from './types';
	import { useStatistics } from './context';

	type Props = {
		limit?: number;
		/** Rows shown until "Show all" is pressed; the rest stays hidden behind the button. */
		collapsed?: number;
		compact?: boolean;
		/** Makes each row a link, e.g. to filter the page on that map. */
		mapHref?: (map: string) => string;
		class?: string;
	};

	let { limit, collapsed, compact = false, mapHref, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const context = useStatistics();
	const maps = $derived(context.statistics.maps);
	const selected = $derived(context.selected);
	// Each map's share: of every match, or of the maps listed when filtered on one.
	const matchCount = $derived(
		selected ? maps.reduce((sum, row) => sum + row.played, 0) : context.statistics.matchCount
	);
	let expanded = $state(false);
	const canCollapse = $derived(collapsed !== undefined && maps.length > collapsed);
	// A selected map further down keeps the list open, so its row stays visible.
	const selectedHidden = $derived(
		collapsed !== undefined && maps.findIndex((row) => row.map === selected) >= collapsed
	);
	const shown = $derived(canCollapse && !expanded && !selectedHidden ? collapsed : limit);
	const rows = $derived(shown === undefined ? maps : maps.slice(0, shown));
	const mostPlayed = $derived(maps[0]?.played ?? 0);
	const columns = $derived(mapColumns(compact));
	const rowClass = $derived(
		cn('grid items-center gap-3 px-4', compact ? 'py-1.5' : 'py-2', columns)
	);
</script>

{#snippet cells(row: StatisticsMap, index: number)}
	{@const length = minutes(row.avgDurationSeconds)}
	{#if !compact}
		<span class="text-secondary-500 tabular-nums">{index + 1}</span>
	{/if}
	<div class="flex min-w-0 items-center gap-3">
		<MapImage map={row.map} small={compact} alt={normalizeMapName(row.map)} />
		<span class="min-w-0 truncate font-medium text-white">{normalizeMapName(row.map)}</span>
	</div>
	<p class={cn('tabular-nums', compact && 'text-right')}>
		<span class="text-white">{formatCount(row.played, host.locale())}</span>
		{#if !compact}
			<span class="text-secondary-500 ml-1 text-xs">{percent(row.played, matchCount)}</span>
		{/if}
	</p>
	{#if !compact}
		<span class="text-secondary-300 text-right tabular-nums">
			{length === null ? '-' : t('{minutes} min', { minutes: length })}
		</span>
	{/if}
	{@render frontLine(row)}
{/snippet}

{#snippet frontLine(row: StatisticsMap)}
	{@const allies = row.decided > 0 ? (row.alliesWins / row.decided) * 100 : 50}
	{@const alliesLead = row.decided > 0 && allies > 50}
	{@const axisLead = row.decided > 0 && allies < 50}
	<div
		class="flex items-center gap-2 text-xs tabular-nums"
		{@attach tooltip(
			t('Allies {allies} · Axis {axis}', {
				allies: row.alliesWins,
				axis: row.decided - row.alliesWins
			})
		)}
	>
		<span
			class={cn('w-7 text-right', alliesLead ? 'font-bold text-sky-300' : 'text-secondary-500')}
		>
			{row.decided > 0 ? Math.round(allies) : '-'}
		</span>
		<div class="relative h-1 flex-1 rounded-full bg-red-400/30">
			<div
				class="absolute inset-y-0 left-0 rounded-l-full bg-sky-400/55"
				style:width="{allies}%"
			></div>
			<div class="bg-secondary-600 absolute -inset-y-1 left-1/2 w-px"></div>
			<div
				class="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-white"
				style:left="{allies}%"
			></div>
		</div>
		<span class={cn('w-7', axisLead ? 'font-bold text-red-300' : 'text-secondary-500')}>
			{row.decided > 0 ? 100 - Math.round(allies) : '-'}
		</span>
	</div>
{/snippet}

<div class={cn('text-sm', className)}>
	<div class="overflow-x-auto">
		<div class={compact ? undefined : 'min-w-[38rem]'}>
			<div class={cn(tableHeadRow, 'grid items-center gap-3 px-4 py-2', columns)}>
				{#if !compact}
					<span>#</span>
				{/if}
				<span>{t('Map')}</span>
				<span class={compact ? 'text-right' : undefined}>{t('Played')}</span>
				{#if !compact}
					<span class="text-right">{t('Length')}</span>
				{/if}
				<span class="flex justify-between px-9">
					<span class="text-sky-300/80">{t('Allies')}</span>
					<span class="text-red-300/80">{t('Axis')}</span>
				</span>
			</div>
			<ul>
				{#each rows as row, index (row.map)}
					{@const active = row.map === selected}
					<li
						class={cn(
							'border-secondary-800 relative isolate border-b',
							active && 'bg-primary/10 shadow-[inset_2px_0_0_var(--color-primary)]'
						)}
					>
						<!-- A full-width bar has no edge to mark; its border would double the container's. -->
						<div
							class={cn(
								'bg-primary/[0.06] border-primary/25 pointer-events-none absolute inset-y-0 left-0 -z-10',
								row.played < mostPlayed && 'border-r'
							)}
							style:width="{mostPlayed > 0 ? (row.played / mostPlayed) * 100 : 0}%"
						></div>
						{#if mapHref}
							<a
								href={mapHref(row.map)}
								aria-current={active ? 'true' : undefined}
								data-sveltekit-noscroll
								data-sveltekit-keepfocus
								class={cn(interactive, rowClass, 'transition-colors hover:bg-white/[0.03]')}
							>
								{@render cells(row, index)}
							</a>
						{:else}
							<div class={rowClass}>{@render cells(row, index)}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</div>
	{#if canCollapse && !selectedHidden}
		<div class="flex justify-center px-4 py-3">
			<Button
				variant="secondary"
				size="sm"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? t('Show less') : t('Show all {count} maps', { count: maps.length })}
			</Button>
		</div>
	{/if}
</div>
