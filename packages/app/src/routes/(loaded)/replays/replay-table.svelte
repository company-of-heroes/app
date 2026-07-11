<script lang="ts">
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import { tooltip } from '$lib/attachments';
	import SortAscending from 'phosphor-svelte/lib/ArrowDown';
	import SortDescending from 'phosphor-svelte/lib/ArrowUp';
	import Sortable from 'phosphor-svelte/lib/ArrowsDownUp';
	import dayjs from '$lib/dayjs';
	import type { ReplaysExpanded } from '$core/app/database/replays';
	import type { ReplayList } from './replay-list.svelte';

	interface Props {
		list: ReplayList;
	}

	let { list }: Props = $props();

	const columns: ColumnDef<ReplaysExpanded>[] = [
		{ id: 'title', header: 'Title', width: 'w-4/24', class: 'truncate', accessor: (item) => item.title },
		{ id: 'allies', header: 'Allies', width: 'w-3/24', class: 'flex gap-2' },
		{ id: 'axis', header: 'Axis', width: 'w-3/24', class: 'flex gap-2' },
		{ id: 'duration', header: 'Duration', width: 'w-3/24', sortable: true, onSort: toggleDurationSort, headerClass: 'flex items-center select-none' },
		{ id: 'players', header: 'Players', width: 'w-2/24', class: 'text-center', headerClass: 'text-center', accessor: (item) => item.players?.length },
		{ id: 'map', header: 'Map', width: 'w-5/24', class: 'flex items-center gap-4' },
		{ id: 'date', header: 'Date', width: 'w-4/24', class: 'truncate', sortable: true, onSort: toggleDateSort, headerClass: 'flex items-center select-none' }
	];

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) return;
			if (list.isLoading || !list.hasMore) return;
			list.loadMore();
		});

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	function toggleDurationSort() {
		list.filters.sort.gameDate = '';
		if (list.filters.sort.duration === 'durationInSeconds') {
			list.filters.sort.duration = '-durationInSeconds';
		} else {
			list.filters.sort.duration = 'durationInSeconds';
		}
	}

	function toggleDateSort() {
		list.filters.sort.duration = '';
		if (list.filters.sort.gameDate === 'gameDate') {
			list.filters.sort.gameDate = '-gameDate';
		} else {
			list.filters.sort.gameDate = 'gameDate';
		}
	}

	function isFilteredPlayer(name: string) {
		const normalized = name.toLowerCase();
		return list.filters.players.some((player) => player.toLowerCase() === normalized);
	}
</script>

{#snippet header_duration()}
	<span class="flex w-full items-center">
		Duration
		{#if list.filters.sort.duration === 'durationInSeconds'}
			<SortAscending class="ml-auto inline-block" weight="duotone" size="18" />
		{:else if list.filters.sort.duration === '-durationInSeconds'}
			<SortDescending class="ml-auto inline-block" weight="duotone" size="18" />
		{:else}
			<Sortable class="ml-auto inline-block" weight="duotone" />
		{/if}
	</span>
{/snippet}
{#snippet header_date()}
	<span class="flex w-full items-center">
		Date
		{#if list.filters.sort.gameDate === 'gameDate'}
			<SortAscending class="ml-auto inline-block" weight="duotone" size="18" />
		{:else if list.filters.sort.gameDate === '-gameDate'}
			<SortDescending class="ml-auto inline-block" weight="duotone" size="18" />
		{:else}
			<Sortable class="ml-auto inline-block" weight="duotone" />
		{/if}
	</span>
{/snippet}
{#snippet cell_allies({ row }: { row: ReplaysExpanded })}
	{@const allies = row.players?.filter((p) => p.faction.startsWith('allies')) || []}
	<span class="flex items-center gap-2">
		{#each allies as player (player.id)}
			<img
				src={getFactionFlagFromRace(
					player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
				)}
				alt={player.faction}
				class={cn(
					'h-4 w-4 rounded-full object-cover ring-4',
					isFilteredPlayer(player.name) ? 'ring-primary' : 'ring-secondary-800'
				)}
				{@attach tooltip(player.name)}
			/>
		{/each}
	</span>
{/snippet}
{#snippet cell_axis({ row }: { row: ReplaysExpanded })}
	{@const axis = row.players?.filter((p) => p.faction.startsWith('axis')) || []}
	<span class="flex items-center gap-2">
		{#each axis as player (player.id)}
			<img
				src={getFactionFlagFromRace(
					player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
				)}
				alt={player.faction}
				class={cn(
					'h-4 w-4 rounded-full object-cover ring-4',
					isFilteredPlayer(player.name) ? 'ring-primary' : 'ring-secondary-800'
				)}
				{@attach tooltip(player.name)}
			/>
		{/each}
	</span>
{/snippet}
{#snippet cell_duration({ row }: { row: ReplaysExpanded })}
	{dayjs
		.duration(row.durationInSeconds, 'seconds')
		.format(row.durationInSeconds < 3600 ? 'm[min]' : 'H[hr] m[min]')}
{/snippet}
{#snippet cell_map({ row }: { row: ReplaysExpanded })}
	<MapImage small map={row.mapFilename.split(/[/\\]/).pop()} />
	<span class="truncate">{getString(row.mapName)}</span>
{/snippet}
{#snippet cell_date({ row }: { row: ReplaysExpanded })}
	{dayjs(row.gameDate).format('YYYY-MM-DD HH:mm')}
{/snippet}
{#snippet tableFooter()}
	{#if list.replays.length > 0 || !list.isLoading}
		<div use:viewport>
			<small>
				{#if list.replays.length > 0}
					Showing {list.replays.length} replays
					{#if list.isLoading}
						(loading...)
					{/if}
				{:else}
					No replays found.
				{/if}
			</small>
		</div>
	{/if}
{/snippet}

<DataTable
	data={list.replays}
	{columns}
	rowKey={(item) => item.id}
	rowHref={(item) => `/replays/${item.id}`}
	rowClass={() => 'text-secondary-300'}
	loading={list.isLoading && list.replays.length === 0}
	skeletonRows={10}
	empty=""
	headers={{ duration: header_duration, date: header_date }}
	cells={{
		allies: cell_allies,
		axis: cell_axis,
		duration: cell_duration,
		map: cell_map,
		date: cell_date
	}}
>
	{@render tableFooter()}
</DataTable>
