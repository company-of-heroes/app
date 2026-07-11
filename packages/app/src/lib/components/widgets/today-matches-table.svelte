<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import * as Match from '$lib/components/match';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import MatchLobbyPlayers from './match-lobby-players.svelte';
	import { getMatchModeLabel } from './dashboard-utils';

	type Props = {
		matches: MatchExpanded[];
		loading?: boolean;
	};

	let { matches, loading = false }: Props = $props();
	let expandedId = $state<string | null>(null);

	function toggleExpanded(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<table class="w-full table-fixed">
	<colgroup>
		<col class="w-2/24" />
		<col class="w-5/24" />
		<col class="w-2/24" />
		<col class="w-3/24" />
		<col class="w-3/24" />
		<col class="w-3/24" />
		<col class="w-3/24" />
		<col class="w-2/24" />
		<col class="w-1/24" />
	</colgroup>
	<thead>
		<tr
			class="bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b text-left text-xs font-semibold tracking-wide uppercase"
		>
			<th class="px-4 py-3 font-semibold">Map</th>
			<th class="px-4 py-3 font-semibold">Name</th>
			<th class="px-4 py-3 font-semibold">Type</th>
			<th class="px-4 py-3 font-semibold">Allies</th>
			<th class="px-4 py-3 font-semibold">Axis</th>
			<th class="px-4 py-3 font-semibold">Duration</th>
			<th class="px-4 py-3 font-semibold">Rating</th>
			<th class="px-4 py-3 text-center font-semibold">Status</th>
			<th class="px-4 py-3"></th>
		</tr>
	</thead>
	<tbody>
		{#if loading}
			{#each Array(3) as _, index (index)}
				<tr class="border-secondary-800 h-11 border-b">
					{#each Array(9) as _, cellIndex (cellIndex)}
						<td class="px-4">
							<Skeleton class="h-4 w-full" />
						</td>
					{/each}
				</tr>
			{/each}
		{:else}
			{#each matches as match (match.id)}
				{@const expanded = expandedId === match.id}
				<Match.Root {match}>
					<tr
						class={cn(
							interactive,
							'border-secondary-800 text-secondary-300 h-11 border-b transition-colors',
							'hover:bg-secondary-950/60 hover:text-primary',
							expanded && 'bg-secondary-950/60 text-primary'
						)}
						aria-expanded={expanded}
						onclick={() => toggleExpanded(match.id)}
					>
						<td class="px-4">
							<a
								href="/history/{match.id}"
								class={interactive}
								onclick={(event) => event.stopPropagation()}
							>
								<Match.MapImage small class="w-10" />
							</a>
						</td>
						<td class="truncate px-4 font-medium">
							<Match.Title class="text-secondary-300" />
						</td>
						<td class="text-secondary-400 truncate px-4 text-sm">
							{getMatchModeLabel(match)}
						</td>
						<td
							class={cn(
								'px-4',
								match.alliesOutcome === 'win' && 'bg-green-500/5',
								match.alliesOutcome === 'loss' && 'bg-red-500/5'
							)}
							onclick={(event) => event.stopPropagation()}
						>
							<Match.Players
								team="allies"
								bind:outcome={match.alliesOutcome}
								class="flex items-center gap-1.5 overflow-visible"
							/>
						</td>
						<td
							class={cn(
								'px-4',
								match.axisOutcome === 'win' && 'bg-green-500/5',
								match.axisOutcome === 'loss' && 'bg-red-500/5'
							)}
							onclick={(event) => event.stopPropagation()}
						>
							<Match.Players
								team="axis"
								bind:outcome={match.axisOutcome}
								class="flex items-center gap-1.5 overflow-visible"
							/>
						</td>
						<td class="text-secondary-400 truncate px-4 text-sm">
							<Match.Duration />
						</td>
						<td class="px-4">
							<Match.Rating class="text-sm" />
						</td>
						<td class="px-4">
							<div class="flex justify-center">
								<Match.Status />
							</div>
						</td>
						<td class="px-4">
							<CaretDown class={cn('size-4 transition-transform', expanded && 'rotate-180')} />
						</td>
					</tr>
					{#if expanded}
						<tr>
							<td colspan="9" class="p-0">
								<MatchLobbyPlayers {match} />
							</td>
						</tr>
					{/if}
				</Match.Root>
			{/each}
		{/if}
	</tbody>
</table>
