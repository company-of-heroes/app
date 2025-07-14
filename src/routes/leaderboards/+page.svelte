<script lang="ts">
	import { cn, getFactionFlagFromRace, getRankImage } from '$lib/utils';
	import { relic } from '$lib/relic';
	import { resource } from 'runed';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { createRawSnippet } from 'svelte';

	const leaderboards = [
		{
			label: '1v1',
			value: '4',
			leaderboardFationIds: [
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border-1 border-black" />`
					})),
					value: '4'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border-1 border-black" />`
					})),
					value: '6'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border-1 border-black" />`
					})),
					value: '5'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(3)}" alt="Panzer Elite" class="w-7 border-1 border-black" />`
					})),
					value: '7'
				}
			]
		},
		{
			label: '2v2',
			value: '8',
			leaderboardFationIds: [
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border-1 border-black" />`
					})),
					value: '8'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border-1 border-black" />`
					})),
					value: '10'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border-1 border-black" />`
					})),
					value: '9'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(4)}" alt="Panzer Elite" class="w-7 border-1 border-black" />`
					})),
					value: '11'
				}
			]
		},
		{
			label: '3v3',
			value: '12',
			leaderboardFationIds: [
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border-1 border-black" />`
					})),
					value: '12'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border-1 border-black" />`
					})),
					value: '14'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border-1 border-black" />`
					})),
					value: '13'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(4)}" alt="Panzer Elite" class="w-7 border-1 border-black" />`
					})),
					value: '15'
				}
			]
		},
		{
			label: '4v4',
			value: '16',
			leaderboardFationIds: [
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(0)}" alt="Allies" class="w-7 border-1 border-black" />`
					})),
					value: '16'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(2)}" alt="British" class="w-7 border-1 border-black" />`
					})),
					value: '18'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(1)}" alt="Wehrmacht" class="w-7 border-1 border-black" />`
					})),
					value: '17'
				},
				{
					label: createRawSnippet(() => ({
						render: () =>
							`<img src="${getFactionFlagFromRace(4)}" alt="Panzer Elite" class="w-7 border-1 border-black" />`
					})),
					value: '19'
				}
			]
		}
	];

	let leaderboardId = $state(leaderboards[0].value);
	let leaderboardFactionId = $derived<string>(
		leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds[0].value
	);
	let leaderboardFactionsIds = $derived(
		leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds!
	);

	function getRatioColor(wins: number, losses: number): string {
		if (losses === 0) return wins > 0 ? 'text-lime-600' : 'text-gray-400';

		const ratio = wins / losses;

		if (ratio >= 5) return 'text-lime-600/70';
		if (ratio >= 4) return 'text-lime-500/70';
		if (ratio >= 3) return 'text-lime-400/70';
		if (ratio >= 2) return 'text-lime-300/70';
		if (ratio >= 1) return 'text-lime-200/70';

		return 'text-lime-100/70';
	}

	const statsResource = resource(
		() => [leaderboardFactionId, leaderboardId],
		() => relic.getLeaderboard(parseInt(leaderboardFactionId)),
		{
			initialValue: []
		}
	);
</script>

<form class="mb-4 flex items-center gap-2">
	<ToggleGroup bind:value={leaderboardId} items={leaderboards} />
	<ToggleGroup bind:value={leaderboardFactionId} items={leaderboardFactionsIds} />
</form>

<div class={cn('flex flex-grow flex-col gap-[1px]')}>
	<div
		class={cn(
			'flex items-center gap-[1px]',
			'[&>span]:bg-secondary-800 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4 [&>span]:font-bold [&>span]:text-white'
		)}
	>
		<span class="flex w-12 justify-center">#</span>
		<span class="flex w-24">Rank</span>
		<span class="flex-grow">Player</span>
		<span class="flex w-28 justify-center">Wins</span>
		<span class="flex w-28 justify-center">Losses</span>
		<span class="flex w-28 justify-center">Streak</span>
		<span class="flex w-28 justify-center">Ratio</span>
	</div>
	{#if statsResource.loading}
		{#each Array(5)}
			<div
				class={cn(
					'flex items-center gap-[1px]',
					'[&>span]:bg-primary/5 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
				)}
			>
				<span class="flex w-12 animate-pulse justify-center bg-gray-300"></span>
				<span class="flex w-24 animate-pulse bg-gray-300"></span>
				<span class="flex-grow animate-pulse bg-gray-300"></span>
				<span class="flex w-28 animate-pulse justify-center bg-gray-300"></span>
				<span class="flex w-28 animate-pulse justify-center bg-gray-300"></span>
				<span class="flex w-28 animate-pulse justify-center bg-gray-300"></span>
				<span class="flex w-28 animate-pulse justify-center bg-gray-300"></span>
			</div>
		{/each}
	{:else}
		{#each statsResource.current as stat}
			<div
				class={cn(
					'flex items-center gap-[1px]',
					'[&>span]:bg-primary/5 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
				)}
			>
				<span class="flex w-12 justify-center">{stat.rank}</span>
				<span class="relative flex w-24 items-center gap-4">
					{#await getRankImage(0, stat.ranklevel) then rankImage}
						<img src={rankImage} alt={`${stat.ranklevel}`} class="relative w-6" />
					{/await}
					<span class="relative top-[1px] font-medium text-white">{stat.ranklevel}</span>
				</span>
				<span class="text-primary-50 flex-grow">{stat.profile?.alias}</span>
				<span class="flex w-28 justify-center font-medium">{stat.wins}</span>
				<span class="flex w-28 justify-center font-medium text-red-100">{stat.losses}</span>
				<span
					class={cn(
						'flex w-28 justify-center',
						stat.streak < 0 ? 'text-red-500' : 'text-green-600'
					)}>{stat.streak}</span
				>
				<span class={cn('flex w-28 justify-center', getRatioColor(stat.wins, stat.losses))}>
					{stat.losses > 0 ? (stat.wins / stat.losses).toFixed(2) : stat.wins > 0 ? '∞' : '0.00'}
				</span>
			</div>
		{/each}
	{/if}
</div>
