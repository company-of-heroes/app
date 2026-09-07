<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { MatchListColumnId } from './match-list-columns';
	import MatchRoot from './match.svelte';
	import MatchMapImage from './match-map-image.svelte';
	import MatchMapName from './match-map-name.svelte';
	import MatchProBadge from './match-pro-badge.svelte';
	import MatchPendingBadge from './match-pending-badge.svelte';
	import MatchPlayers from './match-players.svelte';
	import MatchRating from './match-rating.svelte';
	import MatchDate from './match-date.svelte';
	import MatchDuration from './match-duration.svelte';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import MatchLobbyPlayers from '$lib/components/widgets/match-lobby-players.svelte';
	import { getMatchModeLabel } from '$lib/components/widgets/dashboard-utils';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { useI18n } from '$lib/i18n';

	type Props = {
		matches: MatchExpanded[];
		loading?: boolean;
		columns?: MatchListColumnId[];
		showMap?: boolean;
		showRating?: boolean;
		expandable?: boolean;
		highlightedPlayers?: string[];
		emptyMessage?: string;
		class?: string;
		footer?: Snippet;
		expandContent?: Snippet<[{ row: MatchExpanded }]>;
		detailsHref?: (row: MatchExpanded) => string | undefined;
	};

	let {
		matches,
		loading = false,
		columns: columnIds,
		showMap = true,
		showRating = true,
		expandable = true,
		highlightedPlayers = [],
		emptyMessage,
		class: className,
		footer,
		expandContent,
		detailsHref
	}: Props = $props();
	const { t } = useI18n();

	let expandedId = $state<string | null>(null);

	const resolvedColumnIds = $derived.by((): MatchListColumnId[] => {
		if (columnIds?.length) return columnIds;
		const ids: MatchListColumnId[] = [];
		if (showMap) ids.push('map');
		ids.push('name', 'type', 'allies', 'axis', 'duration');
		if (showRating) ids.push('rating');
		ids.push('actions');
		if (expandable) ids.push('expand');
		return ids;
	});
	const canExpand = $derived(resolvedColumnIds.includes('expand'));
	const columnDefs = $derived.by(() => {
		const defs: Record<MatchListColumnId, ColumnDef<MatchExpanded>> = {
			map: {
				id: 'map',
				header: t('Map'),
				width: 'w-2/24',
				class: 'flex h-full items-center',
				cellClass: () => 'overflow-clip py-0 pr-0 pl-4'
			},
			name: {
				id: 'name',
				header: t('Name'),
				width: 'w-5/24',
				class: 'min-w-0 truncate font-medium'
			},
			type: {
				id: 'type',
				header: t('Type'),
				width: 'w-2/24',
				class: 'text-secondary-400 truncate text-sm'
			},
			allies: {
				id: 'allies',
				header: t('Allies'),
				width: 'w-3/24',
				class: 'flex h-full items-center overflow-visible',
				cellClass: (row) =>
					cn(
						row.alliesOutcome === 'win' && 'bg-green-500/5',
						row.alliesOutcome === 'loss' && 'bg-red-500/5'
					)
			},
			axis: {
				id: 'axis',
				header: t('Axis'),
				width: 'w-3/24',
				class: 'flex h-full items-center overflow-visible',
				cellClass: (row) =>
					cn(
						row.axisOutcome === 'win' && 'bg-green-500/5',
						row.axisOutcome === 'loss' && 'bg-red-500/5'
					)
			},
			duration: {
				id: 'duration',
				header: t('Duration'),
				width: 'w-3/24',
				class: 'text-secondary-400 truncate text-sm'
			},
			rating: { id: 'rating', header: t('Rating'), width: 'w-3/24' },
			date: {
				id: 'date',
				header: t('Date'),
				width: 'w-3/24',
				class: 'text-secondary-400 truncate text-sm'
			},
			actions: { id: 'actions', header: '', width: 'w-3/24', hideSkeleton: true },
			expand: {
				id: 'expand',
				header: '',
				width: 'w-1/24',
				headerCellClass: 'p-0',
				cellClass: () => 'p-0',
				class: 'flex w-full justify-center',
				hideSkeleton: true
			}
		};
		return resolvedColumnIds.map((id) => defs[id]);
	});

	function toggleExpanded(id: string) {
		if (!canExpand) return;
		expandedId = expandedId === id ? null : id;
	}

	function openDetails(event: MouseEvent, href: string) {
		event.stopPropagation();
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void goto(href);
	}
</script>

{#snippet cell_map({ row }: { row: MatchExpanded })}
	<MatchMapImage small flush />
{/snippet}
{#snippet cell_name({ row }: { row: MatchExpanded })}
	<span class="flex min-w-0 items-center gap-2">
		<MatchMapName class="text-secondary-300 min-w-0 truncate font-medium" />
		<MatchPendingBadge />
		<MatchProBadge />
	</span>
{/snippet}
{#snippet cell_type({ row }: { row: MatchExpanded })}
	{getMatchModeLabel(row)}
{/snippet}
{#snippet cell_allies({ row }: { row: MatchExpanded })}
	<MatchPlayers
		team="allies"
		bind:outcome={row.alliesOutcome}
		{highlightedPlayers}
		class="flex items-center gap-1.5 overflow-visible"
	/>
{/snippet}
{#snippet cell_axis({ row }: { row: MatchExpanded })}
	<MatchPlayers
		team="axis"
		bind:outcome={row.axisOutcome}
		{highlightedPlayers}
		class="flex items-center gap-1.5 overflow-visible"
	/>
{/snippet}
{#snippet cell_duration({ row }: { row: MatchExpanded })}
	<MatchDuration />
{/snippet}
{#snippet cell_rating({ row }: { row: MatchExpanded })}
	<MatchRating class="text-sm" profileId={highlightedPlayers[0]} />
{/snippet}
{#snippet cell_date({ row }: { row: MatchExpanded })}
	<MatchDate class="text-sm" />
{/snippet}
{#snippet cell_actions({ row }: { row: MatchExpanded })}
	{@const href = detailsHref ? detailsHref(row) : `/history/${row.id}`}
	{#if href}
		<Button
			{href}
			size="sm"
			variant="secondary"
			class="h-7 px-2.5 text-xs"
			onclick={(event) => openDetails(event, href)}
		>
			{t('Details')}
		</Button>
	{/if}
{/snippet}
{#snippet cell_expand({ row }: { row: MatchExpanded })}
	<CaretDownIcon
		class={cn(
			'pointer-events-none size-4 transition-transform',
			expandedId === row.id && 'rotate-180'
		)}
	/>
{/snippet}
{#snippet matchRowWrapper({ row, children }: { row: MatchExpanded; children: Snippet })}
	{@const expanded = canExpand && expandedId === row.id}
	<MatchRoot match={row}>
		{@render children()}
		{#if expanded}
			<tr class="border-secondary-800 border-b">
				<td colspan={columnDefs.length} class="p-0">
					{#if expandContent}
						{@render expandContent({ row })}
					{:else}
						<MatchLobbyPlayers match={row} />
					{/if}
				</td>
			</tr>
		{/if}
	</MatchRoot>
{/snippet}

<div class={className}>
	{#if !loading && matches.length === 0 && emptyMessage}
		<p class="text-secondary-400 px-4 py-2 text-sm">{t(emptyMessage)}</p>
	{:else}
		<DataTable
			data={matches}
			columns={columnDefs}
			rowKey={(match) => match.id}
			onRowClick={canExpand ? (match) => toggleExpanded(match.id) : undefined}
			isRowExpanded={(match) => canExpand && expandedId === match.id}
			rowWrapper={matchRowWrapper}
			{loading}
			skeletonRows={3}
			striped={false}
			empty={emptyMessage ?? t('No matches.')}
			cells={{
				map: cell_map,
				name: cell_name,
				type: cell_type,
				allies: cell_allies,
				axis: cell_axis,
				duration: cell_duration,
				rating: cell_rating,
				date: cell_date,
				actions: cell_actions,
				expand: cell_expand
			}}
		/>
	{/if}
	{#if footer}
		{@render footer()}
	{/if}
</div>
