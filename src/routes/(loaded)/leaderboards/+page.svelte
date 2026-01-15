<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import * as Form from '$lib/components/ui/form';
	import * as Table from '$lib/components/ui/table';
	import { cn, getRankImageByLeaderboardId } from '$lib/utils';
	import { relic } from '$lib/relic';
	import { resource, useDebounce } from 'runed';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { H } from '$lib/components/ui/h';
	import { leaderboards } from '$lib/utils/game';
	import Input from '$lib/components/ui/input/input.svelte';
	import { isEmpty } from 'lodash-es';

	let leaderboardId = $state(leaderboards[0].value);
	let leaderboardFactionId = $derived<string>(
		leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds[0].value
	);
	let leaderboardFactionsIds = $derived(
		leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds!
	);
	let searchInput = $state<string | undefined>();
	let filteredStats = $derived.by(() => statsResource.current);

	function getRatioColor(wins: number, losses: number): string {
		if (losses === 0) return wins > 0 ? 'text-success' : 'text-secondary-400';

		const ratio = wins / losses;

		if (ratio >= 5) return 'text-success';
		if (ratio >= 4) return 'text-success/90';
		if (ratio >= 3) return 'text-success/80';
		if (ratio >= 2) return 'text-success/70';
		if (ratio >= 1) return 'text-success/60';

		return 'text-success/50';
	}

	const statsResource = resource(
		() => [leaderboardFactionId, leaderboardId],
		() => relic.getLeaderboard(parseInt(leaderboardFactionId)),
		{
			initialValue: []
		}
	);

	const searchPlayer = useDebounce(
		() => {
			const query = searchInput?.trim().toLowerCase();

			if (!query || isEmpty(query)) {
				filteredStats = statsResource.current;
				return;
			}

			const results = statsResource.current.filter(
				(stat) =>
					stat.profile?.alias.toLowerCase().startsWith(query) ||
					stat.profile?.alias.toLowerCase().includes(query)
			);

			filteredStats = results;
		},
		() => 250
	);

	export const snapshot: Snapshot<[string, string]> = {
		capture: () => [leaderboardFactionId, leaderboardId],
		restore: ([factionId, leaderboardId]) => {
			leaderboardId = leaderboardId;
			leaderboardFactionId = factionId;
		}
	};
</script>

<H level="1">Leaderboards</H>
<form class="mb-4 flex items-center justify-between gap-2">
	<div class="flex gap-4">
		<ToggleGroup bind:value={leaderboardId} items={leaderboards} />
		<ToggleGroup bind:value={leaderboardFactionId} items={leaderboardFactionsIds} />
	</div>
	<Form.Root>
		<Input
			type="text"
			placeholder="Search player..."
			class={cn('w-58')}
			bind:value={searchInput}
			oninput={() => searchPlayer()}
		/>
	</Form.Root>
</form>

<div class={cn('flex grow flex-col')}>
	<Table.Table>
		<Table.THead>
			<Table.tr>
				<Table.TH width="1/24">#</Table.TH>
				<Table.TH width="2/24">Rank</Table.TH>
				<Table.TH width="13/24">Alias</Table.TH>
				<Table.TH width="2/24" class="text-center">Wins</Table.TH>
				<Table.TH width="2/24" class="text-center">Losses</Table.TH>
				<Table.TH width="2/24">Streak</Table.TH>
				<Table.TH width="2/24">Ratio</Table.TH>
			</Table.tr>
		</Table.THead>
		{#if statsResource.loading}
			{#each Array(5)}
				<Table.TR>
					<Table.TD width="1/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="2/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="13/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="2/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="2/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="2/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
					<Table.TD width="2/24" class="animate-pulse">
						<div class="h-3 w-full rounded-full bg-gray-700"></div>
					</Table.TD>
				</Table.TR>
			{/each}
		{:else if statsResource.current}
			{#each filteredStats as stat}
				{console.log(stat)}
				<Table.TR href={`/leaderboards/profile/${stat.profile.profile_id}`}>
					<Table.TD width="1/24" class="text-center font-semibold">{stat.rank}</Table.TD>
					<Table.TD width="2/24" class="relative flex items-center gap-4">
						{#await getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel) then rankImage}
							<img src={rankImage} alt={`${stat.ranklevel}`} class="relative w-6" />
						{/await}
						<span class="relative font-medium text-white">{stat.ranklevel}</span>
					</Table.TD>
					<Table.TD width="13/24" class="truncate">{stat.profile?.alias}</Table.TD>
					<Table.TD width="2/24" class="text-center font-medium text-green-200">
						{stat.wins}
					</Table.TD>
					<Table.TD width="2/24" class="text-center font-medium text-red-200">
						{stat.losses}
					</Table.TD>
					<Table.TD
						width="2/24"
						class={cn('text-center', stat.streak < 0 ? 'text-red-300' : 'text-green-300')}
					>
						{stat.streak}
					</Table.TD>
					<Table.TD width="2/24" class={cn('text-center', getRatioColor(stat.wins, stat.losses))}>
						{stat.losses > 0 ? (stat.wins / stat.losses).toFixed(2) : stat.wins > 0 ? '∞' : '0.00'}
					</Table.TD>
				</Table.TR>
			{/each}
		{/if}
	</Table.Table>
</div>
