<script lang="ts">
	import type { UsersResponse } from '$core/pocketbase/types';
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { Snapshot } from './$types';
	import * as Form from '$lib/components/ui/form';
	import * as Table from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { Input, Selection, Checkbox } from '$lib/components/ui/input';
	import { app } from '$core/app/context';
	import { H } from '$lib/components/ui/h';
	import { cn, normalizeMapName } from '$lib/utils';
	import { uniqBy, uniq } from 'lodash-es';
	import { MatchList, type MatchListState } from './match-list.svelte';
	import MatchFilters from './match-filters.svelte';
	import MatchTable from './match-table.svelte';
	import { pocketbase } from '$core/pocketbase';
	import { onMount } from 'svelte';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { Matches } from './matches.svelte';

	let matches = new Matches();
</script>

<H level="1">Match History</H>
<Form.Root>
	<Form.Group>
		<ToggleGroup
			bind:value={matches.scope}
			items={[
				{ label: 'My matches', value: 'user' },
				{ label: 'Community matches', value: 'community' }
			]}
			class="mb-8 w-fit"
		/>
	</Form.Group>
	<Form.Group>
		<Form.Label>Players</Form.Label>
		<Selection bind:value={matches.filters.playerIds} options={matches.players} multiple />
	</Form.Group>
	<Form.Group>
		<Form.Label>Maps</Form.Label>
		<Selection bind:value={matches.filters.maps} options={matches.maps} multiple />
	</Form.Group>
</Form.Root>
<Table.Table>
	<Table.Head>
		<Table.th width="6/24">Map</Table.th>
		<Table.th width="4/24">Name</Table.th>
		<Table.th width="3/24">Allies</Table.th>
		<Table.th width="3/24">Axis</Table.th>
		<Table.th width="3/24">Duration</Table.th>
		<Table.th width="5/24" class="text-end">Date</Table.th>
	</Table.Head>
	{#if matches.matches.loading}
		<Table.tr>
			<Table.td class="py-8 text-center">Loading matches...</Table.td>
		</Table.tr>
	{:else if matches.matches.current}
		{#each matches.matches.current.items as match, _ (match.id)}
			{(match.result as any).description === 'all wellcome' ? console.log(match) : ''}
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
							highlightedPlayers={matches.filters.playerIds}
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
							highlightedPlayers={matches.filters.playerIds}
						/>
					</Table.td>
					<Table.td width="3/24">
						<Match.Duration class="text-secondary-400 text-sm" />
					</Table.td>
					<Table.td width="5/24" class="flex items-center">
						{#if matches.scope === 'user'}
							<Match.Rating />
						{/if}
						<Match.Date class="text-secondary-400 ms-auto text-sm" />
					</Table.td>
				</Table.tr>
			</Match.Root>
		{/each}
	{/if}
</Table.Table>
