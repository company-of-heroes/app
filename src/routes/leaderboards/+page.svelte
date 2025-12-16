<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import * as Form from '$lib/components/ui/form';
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
	<div
		class={cn(
			'border-secondary-600 bg-secondary-700 text-secondary-300 flex items-center gap-1 rounded-md border',
			'text-secondary-100 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4 [&>span]:font-semibold'
		)}
	>
		<span class="flex w-12 justify-center">#</span>
		<span class="flex w-24">Rank</span>
		<span class="grow">Player</span>
		<span class="flex w-28 justify-center">Wins</span>
		<span class="flex w-28 justify-center">Losses</span>
		<span class="flex w-28 justify-center">Streak</span>
		<span class="flex w-28 justify-center">Ratio</span>
	</div>
	{#if statsResource.loading}
		{#each Array(5)}
			<div
				class={cn(
					'flex items-center gap-1 rounded-md',
					'[&>span]:my-2 [&>span]:flex [&>span]:h-3 [&>span]:items-center [&>span]:rounded-full [&>span]:bg-gray-700 [&>span]:px-4'
				)}
			>
				<span class="flex w-12 animate-pulse justify-center"></span>
				<span class="flex w-24 animate-pulse"></span>
				<span class="grow animate-pulse"></span>
				<span class="flex w-28 animate-pulse justify-center"></span>
				<span class="flex w-28 animate-pulse justify-center"></span>
				<span class="flex w-28 animate-pulse justify-center"></span>
				<span class="flex w-28 animate-pulse justify-center"></span>
			</div>
		{/each}
	{:else}
		{#each filteredStats as stat}
			<a
				class={cn(
					'flex items-center gap-1 rounded-md border-b border-gray-700 odd:bg-gray-800',
					'[&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4',
					'hover:bg-gray-700'
				)}
				href={`/leaderboards/profile/${stat.profile.profile_id}`}
			>
				<span class="flex w-12 justify-center">{stat.rank}</span>
				<span class="relative flex w-24 items-center gap-4">
					{#await getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel) then rankImage}
						<img src={rankImage} alt={`${stat.ranklevel}`} class="relative w-6" />
					{/await}
					<span class="relative font-medium text-white">{stat.ranklevel}</span>
				</span>
				<span class="text-primary-50 grow">{stat.profile?.alias}</span>
				<span class="flex w-28 justify-center font-medium text-green-200">{stat.wins}</span>
				<span class="flex w-28 justify-center font-medium text-red-200">{stat.losses}</span>
				<span
					class={cn(
						'flex w-28 justify-center',
						stat.streak < 0 ? 'text-red-300' : 'text-green-300'
					)}
				>
					{stat.streak}
				</span>
				<span class={cn('flex w-28 justify-center', getRatioColor(stat.wins, stat.losses))}>
					{stat.losses > 0 ? (stat.wins / stat.losses).toFixed(2) : stat.wins > 0 ? '∞' : '0.00'}
				</span>
			</a>
		{/each}
	{/if}
</div>
