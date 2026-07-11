<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { Selection, Checkbox } from '$lib/components/ui/input';
	import { H } from '$lib/components/ui/h';
	import { cn } from '$lib/utils';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { Pagination } from '$lib/components/ui/pagination';
	import { app } from '$core/app/context';
	import type { MatchExpanded } from '$core/app/database/matches';

	const matches = $derived(app.features.history?.matches);

	const columns: ColumnDef<MatchExpanded>[] = [
		{ id: 'map', header: 'Map', width: 'w-6/24', class: 'flex items-center gap-4', href: (match) => `/history/${match.id}` },
		{ id: 'name', header: 'Name', width: 'w-4/24' },
		{ id: 'allies', header: 'Allies', width: 'w-3/24', class: 'flex h-full items-center overflow-visible', cellClass: (row) => cn(row.alliesOutcome === 'win' && 'bg-green-500/5', row.alliesOutcome === 'loss' && 'bg-red-500/5') },
		{ id: 'axis', header: 'Axis', width: 'w-3/24', class: 'flex h-full items-center overflow-visible', cellClass: (row) => cn(row.axisOutcome === 'win' && 'bg-green-500/5', row.axisOutcome === 'loss' && 'bg-red-500/5') },
		{ id: 'duration', header: 'Duration', width: 'w-3/24' },
		{ id: 'date', header: 'Date', width: 'w-5/24', class: 'flex items-center', headerClass: 'text-end' }
	];
</script>

<H level="1">Match History</H>
{#if matches}
<ToggleGroup
	bind:value={matches.scope}
	items={[
		{ label: 'My matches', value: 'user' },
		{ label: 'Community matches', value: 'community' }
	]}
	class="mb-4 w-fit"
/>
<div class="flex items-end">
	<Form.Root>
		<Form.Group>
			<Form.Label>Ranked</Form.Label>
			<Checkbox
				bind:checked={matches.filters.ranked}
				label="Show only ranked games"
			/>
		</Form.Group>
		<div class="flex gap-4">
			<Form.Group class="w-fit">
				<Form.Label>Players</Form.Label>
				<Selection
					placeholder="Select players"
					bind:value={matches.filters.playerIds}
					options={matches.players}
					multiple
				/>
			</Form.Group>
			<Form.Group class="w-fit">
				<Form.Label>Maps</Form.Label>
				<Selection
					placeholder="Select maps"
					bind:value={matches.filters.maps}
					options={matches.maps}
					multiple
				/>
			</Form.Group>
		</div>
	</Form.Root>
	{#if matches.result.current}
		<Pagination
			class="ms-auto"
			bind:page={matches.page}
			perPage={matches.perPage}
			count={matches.result.current.totalItems}
		/>
	{/if}
</div>

{#snippet cell_map({ row }: { row: MatchExpanded })}
	<Match.MapImage small />
	<Match.MapName />
{/snippet}
{#snippet cell_name({ row }: { row: MatchExpanded })}
	<Match.Title class="text-secondary-400" />
{/snippet}
{#snippet cell_allies({ row }: { row: MatchExpanded })}
	<Match.Players
		team="allies"
		bind:outcome={row.alliesOutcome}
		highlightedPlayers={matches.filters.playerIds ?? []}
	/>
{/snippet}
{#snippet cell_axis({ row }: { row: MatchExpanded })}
	<Match.Players
		team="axis"
		bind:outcome={row.axisOutcome}
		highlightedPlayers={matches.filters.playerIds ?? []}
	/>
{/snippet}
{#snippet cell_duration({ row }: { row: MatchExpanded })}
	<Match.Duration class="text-secondary-400 text-sm" />
{/snippet}
{#snippet cell_date({ row }: { row: MatchExpanded })}
	{#if matches.scope === 'user'}
		<Match.Rating />
	{/if}
	<Match.Date class="text-secondary-400 ms-auto text-sm" />
{/snippet}
{#snippet matchRowWrapper({ row, children }: { row: MatchExpanded; children: import('svelte').Snippet })}
	<Match.Root match={row}>
		{@render children()}
	</Match.Root>
{/snippet}

{#if matches.result.loading}
	<DataTable
		data={[]}
		{columns}
		rowKey={(match) => match.id}
		loading
		skeletonRows={matches.perPage}
	/>
{:else if matches.result.current}
	<DataTable
		data={matches.result.current.items}
		{columns}
		rowKey={(match) => match.id}
		rowWrapper={matchRowWrapper}
		cells={{
			map: cell_map,
			name: cell_name,
			allies: cell_allies,
			axis: cell_axis,
			duration: cell_duration,
			date: cell_date
		}}
	/>
	<div class="flex">
		<Pagination
			class="ms-auto"
			bind:page={matches.page}
			perPage={matches.perPage}
			count={matches.result.current.totalItems}
		/>
	</div>
{/if}
{/if}
