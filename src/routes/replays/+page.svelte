<script lang="ts">
	import { app } from '$core/app';
	import { Player, type Replay, ReplayParser } from '$core/replay-analyzer';
	import { cn, getMapImageFromName } from '$lib/utils';
	import { readDir, type DirEntry } from '@tauri-apps/plugin-fs';
	import { groupBy } from 'lodash-es';
	import { onMount } from 'svelte';

	const pathToReplays = app.settings.companyOfHeroesConfigPath + '/playback';
	let start = $state(0);
	let end = $state(1);
	let files: DirEntry[] = $state([]);
	let replays: Replay[] = $state([]);

	const getTeams = (players: Player[]) => {
		const teams = groupBy(players, (player) => player.faction.startsWith('allies'));

		return teams;
	};

	onMount(async () => {
		files = (await readDir(pathToReplays)).filter(
			(file) =>
				file.isFile &&
				file.isSymlink === false &&
				file.name.endsWith('.rec') &&
				file.name === 'VIRE RIVER VALLEY (8)  .2025-07-04.23-18-16.rec'
		);
		replays = await Promise.all(
			files
				.slice(start, end)
				.map((file) => ReplayParser.parse(`${pathToReplays}/${file.name}`, false))
		);

		console.log(replays[0].actions);
		console.log(replays[0].players.map((player) => player.doctrine));
	});
</script>

<div class="flex flex-col gap-[2px]">
	<div
		class={cn(
			'flex items-center gap-[1px]',
			'[&>span]:bg-secondary-800 [&>span]:h-10 [&>span]:px-4 [&>span]:leading-10 [&>span]:font-bold'
		)}
	>
		<span class="w-10"></span>
		<span class="w-80">Name</span>
		<span class="w-64">Map</span>
		<span class="w-80">Team #1</span>
		<span class="w-80">Team #2</span>
	</div>
	{#each replays as replay (replay.MD5Hash)}
		<div
			class={cn(
				'flex items-stretch gap-[1px]',
				'[&>span]:bg-primary/5 [&>span]:h-10  [&>span]:px-4  [&>span]:leading-10'
			)}
		>
			{#await getMapImageFromName(replay.mapFileName.split('\\').pop()!) then mapImage}
				<img src={mapImage} alt={replay.mapFileName} class="bg-secondary-800 w-10" />
			{/await}
			<span class="w-80 truncate">{replay.header.replayName || replay.fileName}</span>
			<span class="w-64">{replay.header.mapName}</span>
			{#each replay.teams as players}
				<span class="text-secondary-400 w-80 truncate">
					{@html players
						.map((player) => player.name)
						.join('<span class="inline-block text-secondary-600 mx-2">|</span>')}
				</span>
			{/each}
		</div>
	{/each}
</div>
