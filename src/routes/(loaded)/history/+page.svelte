<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import * as Table from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Selection, Checkbox } from '$lib/components/ui/input';
	import { H } from '$lib/components/ui/h';
	import { cn } from '$lib/utils';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { Pagination } from '$lib/components/ui/pagination';
	import { app } from '$core/app/context';
</script>

<H level="1">Match History</H>
<ToggleGroup
	bind:value={app.features.history.matches.scope}
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
				bind:checked={app.features.history.matches.filters.ranked}
				label="Show only ranked games"
			/>
		</Form.Group>
		<div class="flex gap-4">
			<Form.Group class="w-fit">
				<Form.Label>Players</Form.Label>
				<Selection
					placeholder="Select players"
					bind:value={app.features.history.matches.filters.playerIds}
					options={app.features.history.matches.players}
					multiple
				/>
			</Form.Group>
			<Form.Group class="w-fit">
				<Form.Label>Maps</Form.Label>
				<Selection
					placeholder="Select maps"
					bind:value={app.features.history.matches.filters.maps}
					options={app.features.history.matches.maps}
					multiple
				/>
			</Form.Group>
		</div>
	</Form.Root>
	{#if app.features.history.matches.result.current}
		<Pagination
			class="ms-auto"
			bind:page={app.features.history.matches.page}
			perPage={app.features.history.matches.perPage}
			count={app.features.history.matches.result.current.totalItems}
		/>
	{/if}
</div>

{#if app.features.history.matches.result.loading}
	<Table.Table>
		<Table.Head>
			<Table.tr>
				<Table.th width="6/24">Map</Table.th>
				<Table.th width="4/24">Name</Table.th>
				<Table.th width="3/24">Allies</Table.th>
				<Table.th width="3/24">Axis</Table.th>
				<Table.th width="3/24">Duration</Table.th>
				<Table.th width="5/24" class="text-end">Date</Table.th>
			</Table.tr>
		</Table.Head>
		{#each Array(app.features.history.matches.perPage) as _, i}
			<Table.tr>
				<Table.td width="6/24">
					<Skeleton class="h-4 w-3/4" />
				</Table.td>
				<Table.td width="4/24">
					<Skeleton class="h-4 w-5/6" />
				</Table.td>
				<Table.td width="3/24">
					<Skeleton class="h-4 w-full" />
				</Table.td>
				<Table.td width="3/24">
					<Skeleton class="h-4 w-full" />
				</Table.td>
				<Table.td width="3/24">
					<Skeleton class="h-4 w-1/2" />
				</Table.td>
				<Table.td width="5/24" class="text-end">
					<Skeleton class="ms-auto h-4 w-1/3" />
				</Table.td>
			</Table.tr>
		{/each}
	</Table.Table>
{:else if app.features.history.matches.result.current}
	<Table.Table>
		<Table.Head>
			<Table.tr>
				<Table.th width="6/24">Map</Table.th>
				<Table.th width="4/24">Name</Table.th>
				<Table.th width="3/24">Allies</Table.th>
				<Table.th width="3/24">Axis</Table.th>
				<Table.th width="3/24">Duration</Table.th>
				<Table.th width="5/24" class="text-end">Date</Table.th>
			</Table.tr>
		</Table.Head>
		{#each app.features.history.matches.result.current.items as match, _ (match.id)}
			<Match.Root {match}>
				<Table.tr>
					<Table.td width="6/24" class="flex items-center gap-2" href={`/history/${match.id}`}>
						<Match.MapImage />
						<Match.MapName />
					</Table.td>
					<Table.td width="4/24">
						<Match.Title class="text-secondary-400" />
					</Table.td>
					<Table.td
						width="3/24"
						class={cn(
							'flex h-full items-center',
							match.alliesOutcome === 'win' && 'bg-green-500/5',
							match.alliesOutcome === 'loss' && 'bg-red-500/5'
						)}
					>
						<Match.Players
							team="allies"
							bind:outcome={match.alliesOutcome}
							highlightedPlayers={app.features.history.matches.filters.playerIds}
						/>
					</Table.td>
					<Table.td
						width="3/24"
						class={cn(
							'flex h-full items-center',
							match.axisOutcome === 'win' && 'bg-green-500/5',
							match.axisOutcome === 'loss' && 'bg-red-500/5'
						)}
					>
						<Match.Players
							team="axis"
							bind:outcome={match.axisOutcome}
							highlightedPlayers={app.features.history.matches.filters.playerIds}
						/>
					</Table.td>
					<Table.td width="3/24">
						<Match.Duration class="text-secondary-400 text-sm" />
					</Table.td>
					<Table.td width="5/24" class="flex items-center">
						{#if app.features.history.matches.scope === 'user'}
							<Match.Rating />
						{/if}
						<Match.Date class="text-secondary-400 ms-auto text-sm" />
					</Table.td>
				</Table.tr>
			</Match.Root>
		{/each}
	</Table.Table>
	<div class="flex">
		<Pagination
			class="ms-auto"
			bind:page={app.features.history.matches.page}
			perPage={app.features.history.matches.perPage}
			count={app.features.history.matches.result.current.totalItems}
		/>
	</div>
{/if}
