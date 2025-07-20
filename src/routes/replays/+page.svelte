<script lang="ts">
	import { format } from 'date-fns';
	import { replays } from '$core/app/replays.svelte';
	import { uniq } from 'lodash-es';
	import { Input, Select } from '$lib/components/ui/input';
	import { useDebounce, watch } from 'runed';
	import XIcon from 'phosphor-svelte/lib/X';

	const players = $derived(
		uniq(replays.replays.flatMap((replay) => replay.players.map((player) => player.name)))
	);
	const maps = $derived(uniq(replays.replays.map((replay) => replay.mapName)));

	let selectedPlayers: string[] = $state([]);
	let selectedMaps: string[] = $state([]);
	let searchQuery: string = $state('');

	const search = useDebounce(
		() => {
			if (searchQuery.trim() === '') {
				replays.filtered = replays.replays;
				return;
			}

			replays.filtered = replays.replays.filter((replay) => {
				return (
					replay.replayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
					replay.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
					replay.mapName.toLowerCase().includes(searchQuery.toLowerCase()) ||
					replay.players.some((player) =>
						player.name.toLowerCase().includes(searchQuery.toLowerCase())
					)
				);
			});
		},
		() => 200
	);

	watch(
		() => selectedPlayers,
		() => {
			replays.filtered = replays.replays.filter((replay) => {
				return (
					selectedPlayers.length === 0 ||
					replay.players.some((player) => selectedPlayers.includes(player.name))
				);
			});
		}
	);
</script>

<div class="border-secondary-700 -m-8 mb-6 border-b px-8 py-6">
	<span class="mb-4 block text-xl font-medium">Filters</span>
	<form class="flex items-center gap-1">
		<div>
			<Input placeholder="Search replay" bind:value={searchQuery} oninput={search} />
		</div>
		<div>
			<Select
				items={players.map((player) => ({ label: player, value: player }))}
				bind:value={selectedPlayers}
				type="multiple"
				placeholder="Select Players"
			/>
		</div>
		<div>
			<Select
				items={maps.map((map) => ({ label: map, value: map }))}
				bind:value={selectedMaps}
				type="multiple"
				placeholder="Select Maps"
			/>
		</div>
	</form>
	{#if selectedPlayers.length}
		<div class="item-center mt-4 flex gap-1">
			<span class="text-secondary-400 me-2 leading-8">Players:</span>
			{#each selectedPlayers as player}
				<span class="bg-secondary-700 flex items-center">
					<span class="px-3">{player}</span>
					<button
						class="bg-secondary-800 cursor-pointer p-2 text-red-200"
						onclick={() => {
							selectedPlayers = selectedPlayers.filter((p) => p !== player);
						}}
					>
						<XIcon class="relative top-[1px]" weight="bold" />
					</button>
				</span>
			{/each}
		</div>
	{/if}
	{#if selectedMaps.length}
		<div class="item-center mt-2 flex gap-1">
			<span class="text-secondary-400 me-2 leading-8">Maps:</span>
			{#each selectedMaps as map}
				<span class="bg-secondary-700 flex items-center">
					<span class="px-3">{map}</span>
					<button
						class="bg-secondary-800 cursor-pointer p-2 text-red-200"
						onclick={() => {
							selectedMaps = selectedMaps.filter((p) => p !== map);
						}}
					>
						<XIcon class="relative top-[1px]" weight="bold" />
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>
<div class="grid grid-cols-23 gap-[1px]">
	<span class="bg-secondary-800 col-start-1 col-end-7 h-10 px-4 leading-10 font-bold">Name</span>
	<span class="bg-secondary-800 col-start-7 col-end-11 h-10 px-4 leading-10 font-bold">Map</span>
	<span class="bg-secondary-800 col-start-11 col-end-15 h-10 px-4 text-center leading-10 font-bold">
		Date
	</span>
	<span class="bg-secondary-800 col-start-15 col-end-19 h-10 px-4 leading-10 font-bold">Axis</span>
	<span class="bg-secondary-800 col-start-19 col-end-24 h-10 px-4 leading-10 font-bold">
		Allies
	</span>
	<span class="bg-secondary-800 col-start-1 col-end-24 my-1 h-[2px]"></span>
</div>
<div class="grid gap-[1px]">
	{#each replays.filtered as replay (replay)}
		{@const axisPlayers = replay.teams[0]
			.map((player) => player.name)
			.join(
				'<span class="inline-block h-[22px] top-[5px] relative w-[2px] mx-3 bg-secondary-700"></span>'
			)}
		{@const alliedPlayers = replay.teams[1]
			.map((player) => player.name)
			.join(
				'<span class="inline-block h-[22px] top-[5px] relative w-[2px] mx-3 bg-secondary-700"></span>'
			)}

		<a
			href={`/replays/${replay.fileName}`}
			class="[&>span]:bg-primary/5 hover:[&>span]:bg-primary/7 grid grid-cols-23 gap-[1px] transition-colors duration-200"
		>
			<span class="col-start-1 col-end-7 h-10 truncate px-4 leading-10">
				{replay.replayName || replay.fileName}
			</span>
			<span class="col-start-7 col-end-11 h-10 truncate px-4 leading-10">
				{replay.mapName}
			</span>
			<span
				class="col-start-11 col-end-15 h-10 truncate px-4 text-center leading-10"
				title={format(replay.gameDate, 'dd/MM/yyyy HH:mm')}
			>
				{format(replay.gameDate, 'dd/MM/yyyy HH:mm')}
			</span>
			<span
				class="col-start-15 col-end-19 h-10 truncate px-4 leading-10"
				title={replay.teams[0].map((player) => player.name).join(', ')}
			>
				{@html axisPlayers}
			</span>
			<span
				class="col-start-19 col-end-24 h-10 truncate px-4 leading-10"
				title={replay.teams[1].map((player) => player.name).join(', ')}
			>
				{@html alliedPlayers}
			</span>
		</a>
	{/each}
</div>
